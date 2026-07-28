#!/usr/bin/env python3
"""Parse official rt.molit.go.kr CSV files into normalized trade records.

Safe extraction gate:
- validate preamble / header / encoding
- map 시군구 → 5-digit lawdCd
- emit JSONL + validation report
- NEVER writes into live API serving path
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "molit-raw" / "downloads"
OUT_DIR = ROOT / "data" / "molit-store" / "normalized"
REPORT_DIR = ROOT / "data" / "molit-raw" / "reports"

SALE_REQUIRED = [
    "시군구",
    "단지명",
    "전용면적(㎡)",
    "계약년월",
    "계약일",
    "거래금액(만원)",
]
JEONSE_REQUIRED_ANY = [
    ["보증금(만원)", "보증금"],
    ["월세(만원)", "월세", "월세금(만원)", "월세금"],
]


@dataclass
class TradeRow:
    lawdCd: str
    aptName: str
    dong: str
    jibun: str | None
    exclusiveArea: float
    price: int  # 만원
    floor: int | None
    dealYear: int
    dealMonth: int
    dealDay: int
    dealDate: str
    dealMonthKey: str
    buildYear: int | None
    kind: str  # sale | jeonse
    monthlyRent: int | None
    cancelled: bool
    sourceFile: str


def detect_kind(filename: str, meta_lines: list[str]) -> str:
    blob = " ".join(meta_lines[:20]) + " " + filename
    if "전월세" in blob or "jeonse" in filename.lower() or "rent" in filename.lower():
        return "jeonse"
    return "sale"


def find_header_index(lines: list[str]) -> int:
    for i, line in enumerate(lines[:80]):
        if "단지명" in line and ("계약년월" in line or "계약일" in line):
            return i
    raise ValueError("CSV header row with 단지명/계약년월 not found")


def parse_int_manwon(raw: str | None) -> int | None:
    if raw is None:
        return None
    s = str(raw).strip().replace(",", "").replace('"', "")
    if not s or s == "-":
        return None
    return int(float(s))


def parse_float(raw: str | None) -> float | None:
    if raw is None:
        return None
    s = str(raw).strip().replace(",", "")
    if not s or s == "-":
        return None
    return float(s)


def load_sgg_map(path: Path) -> dict[str, str]:
    """Map '서울특별시 광진구' / '광진구' -> lawdCd."""
    data = json.loads(path.read_text(encoding="utf-8"))
    out: dict[str, str] = {}
    for row in data:
        code = str(row["signguCode"])
        sido = str(row.get("ctprvnNm") or "").strip()
        sgg = str(row.get("signguNm") or "").strip()
        if not sgg:
            continue
        out[sgg] = code
        out[f"{sido} {sgg}".strip()] = code
    return out


def resolve_lawd(sgg_field: str, sgg_map: dict[str, str]) -> str | None:
    s = (sgg_field or "").strip()
    if not s:
        return None
    # CSV: "서울특별시 광진구 광장동"
    parts = s.split()
    if len(parts) >= 2:
        key2 = f"{parts[0]} {parts[1]}"
        if key2 in sgg_map:
            return sgg_map[key2]
        if parts[1] in sgg_map:
            return sgg_map[parts[1]]
    # 세종 등
    if parts and parts[0] in sgg_map:
        return sgg_map[parts[0]]
    return None


def extract_dong(sgg_field: str) -> str:
    parts = (sgg_field or "").split()
    if len(parts) >= 3:
        return " ".join(parts[2:])
    return sgg_field


def pick_col(fieldnames: list[str], candidates: list[str]) -> str | None:
    for c in candidates:
        if c in fieldnames:
            return c
    return None


def parse_file(path: Path, sgg_map: dict[str, str]) -> tuple[list[TradeRow], dict]:
    raw = path.read_bytes()
    text = raw.decode("cp949")
    lines = text.splitlines()
    header_i = find_header_index(lines)
    meta = lines[:header_i]
    kind = detect_kind(path.name, meta)
    table = "\n".join(lines[header_i:])
    reader = csv.DictReader(io.StringIO(table))
    if not reader.fieldnames:
        raise ValueError("empty fieldnames")

    fields = list(reader.fieldnames)
    missing = [c for c in SALE_REQUIRED if c not in fields]
    # jeonse files use 보증금 instead of 거래금액
    if kind == "jeonse":
        missing = [c for c in ["시군구", "단지명", "전용면적(㎡)", "계약년월", "계약일"] if c not in fields]
        if not any(any(x in fields for x in group) for group in JEONSE_REQUIRED_ANY):
            missing.append("보증금/월세")
    elif "거래금액(만원)" not in fields:
        missing.append("거래금액(만원)")

    report = {
        "file": str(path.relative_to(ROOT)),
        "kind": kind,
        "headerIndex": header_i,
        "fieldnames": fields,
        "missingRequired": missing,
        "rowsIn": 0,
        "rowsOut": 0,
        "unmappedSigungu": Counter(),
        "cancelledSkipped": 0,
        "monthlyRentSkipped": 0,
        "parseErrors": 0,
        "byLawdMonth": Counter(),
    }
    if missing:
        return [], report

    price_col = "거래금액(만원)" if kind == "sale" else pick_col(fields, ["보증금(만원)", "보증금"])
    rent_col = pick_col(fields, ["월세(만원)", "월세", "월세금(만원)", "월세금"])
    cancel_col = pick_col(fields, ["해제사유발생일"])
    floor_col = pick_col(fields, ["층"])
    build_col = pick_col(fields, ["건축년도"])
    jibun_col = pick_col(fields, ["번지"])

    out: list[TradeRow] = []
    for row in reader:
        report["rowsIn"] += 1
        try:
            sgg_field = (row.get("시군구") or "").strip()
            lawd = resolve_lawd(sgg_field, sgg_map)
            if not lawd:
                report["unmappedSigungu"][sgg_field or "(empty)"] += 1
                continue

            yyyymm = re.sub(r"\D", "", row.get("계약년월") or "")
            day = int(re.sub(r"\D", "", row.get("계약일") or "0") or 0)
            if len(yyyymm) != 6 or day <= 0:
                report["parseErrors"] += 1
                continue
            year = int(yyyymm[:4])
            month = int(yyyymm[4:6])

            area = parse_float(row.get("전용면적(㎡)"))
            if area is None:
                report["parseErrors"] += 1
                continue

            price = parse_int_manwon(row.get(price_col) if price_col else None)
            if price is None or price <= 0:
                report["parseErrors"] += 1
                continue

            monthly = parse_int_manwon(row.get(rent_col) if rent_col else None) if kind == "jeonse" else None
            if kind == "jeonse" and monthly is not None and monthly > 0:
                report["monthlyRentSkipped"] += 1
                continue  # app uses pure jeonse only

            cancel_raw = (row.get(cancel_col) or "").strip() if cancel_col else ""
            cancelled = bool(cancel_raw and cancel_raw not in {"-", "0"})
            if cancelled:
                report["cancelledSkipped"] += 1
                # keep cancelled out of store for safety
                continue

            floor_raw = (row.get(floor_col) or "").strip() if floor_col else ""
            floor = None
            if floor_raw and floor_raw != "-":
                try:
                    floor = int(float(floor_raw))
                except ValueError:
                    floor = None

            build = parse_int_manwon(row.get(build_col) if build_col else None)

            trade = TradeRow(
                lawdCd=lawd,
                aptName=(row.get("단지명") or "").strip(),
                dong=extract_dong(sgg_field),
                jibun=(row.get(jibun_col) or "").strip() or None if jibun_col else None,
                exclusiveArea=area,
                price=price,
                floor=floor,
                dealYear=year,
                dealMonth=month,
                dealDay=day,
                dealDate=f"{year:04d}-{month:02d}-{day:02d}",
                dealMonthKey=yyyymm,
                buildYear=build,
                kind=kind,
                monthlyRent=0 if kind == "jeonse" else None,
                cancelled=False,
                sourceFile=path.name,
            )
            if not trade.aptName:
                report["parseErrors"] += 1
                continue
            out.append(trade)
            report["byLawdMonth"][f"{lawd}:{yyyymm}:{kind}"] += 1
            report["rowsOut"] += 1
        except Exception:
            report["parseErrors"] += 1

    # JSON-friendly counters
    report["unmappedSigungu"] = dict(report["unmappedSigungu"].most_common(30))
    report["byLawdMonthCount"] = len(report["byLawdMonth"])
    report["sampleBuckets"] = dict(list(report["byLawdMonth"].most_common(10)))
    del report["byLawdMonth"]
    return out, report


def write_normalized(rows: list[TradeRow], out_dir: Path) -> dict[str, int]:
    """Write one JSONL per lawdCd+kind+YYYYMM bucket."""
    buckets: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        key = f"{r.lawdCd}/{r.kind}/{r.dealMonthKey}.jsonl"
        buckets[key].append(asdict(r))

    counts: dict[str, int] = {}
    for key, items in buckets.items():
        path = out_dir / key
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as f:
            for item in items:
                f.write(json.dumps(item, ensure_ascii=False) + "\n")
        counts[key] = len(items)
    return counts


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", action="append", default=[], help="CSV path(s); default=all in downloads/")
    ap.add_argument("--sgg-map", default=str(ROOT / "data/molit-raw/manifests/sgg-seoul.json"))
    ap.add_argument("--write", action="store_true", help="write normalized JSONL buckets")
    args = ap.parse_args()

    sgg_path = Path(args.sgg_map)
    if not sgg_path.exists():
        raise SystemExit(f"sgg map missing: {sgg_path} (run download --list / fetch sgg first)")

    sgg_map = load_sgg_map(sgg_path)
    files = [Path(p) for p in args.input] if args.input else sorted(RAW_DIR.glob("*.csv"))
    if not files:
        raise SystemExit("no CSV files found")

    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    all_rows: list[TradeRow] = []
    reports = []
    for f in files:
        rows, report = parse_file(f, sgg_map)
        reports.append(report)
        all_rows.extend(rows)
        print(
            f"{f.name}: in={report['rowsIn']} out={report['rowsOut']} "
            f"err={report['parseErrors']} unmapped={sum(report['unmappedSigungu'].values())} "
            f"missing={report['missingRequired']}",
            flush=True,
        )

    bucket_counts = write_normalized(all_rows, OUT_DIR) if args.write else {}
    safe = all(
        not r["missingRequired"]
        and r["rowsOut"] > 0
        and sum(r["unmappedSigungu"].values()) / max(1, r["rowsIn"]) < 0.01
        for r in reports
    )
    summary = {
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "files": len(files),
        "rowsIn": sum(r["rowsIn"] for r in reports),
        "rowsOut": sum(r["rowsOut"] for r in reports),
        "safeForMerge": safe,
        "bucketFiles": len(bucket_counts),
        "reports": reports,
    }
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = REPORT_DIR / f"extract-{stamp}.json"
    out.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"report": str(out.relative_to(ROOT)), "safeForMerge": safe, "rowsOut": summary["rowsOut"]}, ensure_ascii=False))
    return 0 if safe else 3


if __name__ == "__main__":
    sys.exit(main())
