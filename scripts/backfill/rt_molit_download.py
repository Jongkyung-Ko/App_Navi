#!/usr/bin/env python3
"""Download apartment sale/jeonse CSV files from rt.molit.go.kr 자료제공.

Official source: https://rt.molit.go.kr/pt/xls/xls.do
- 시도별 최대 1년 / 전국 최대 1개월
- Files are CP949 CSV with a disclaimer preamble + header row

This script only fetches raw files into data/molit-raw/downloads.
It does not change the live /api/trades path.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
import urllib.parse
from dataclasses import asdict, dataclass
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "molit-raw" / "downloads"
MANIFEST_DIR = ROOT / "data" / "molit-raw" / "manifests"
COOKIE = Path("/tmp/rtmolit-cookies.txt")
BASE = "https://rt.molit.go.kr"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)


@dataclass
class Job:
    sido_cd: str
    sido_nm: str
    kind: str  # sale | jeonse
    from_dt: str  # YYYY-MM-DD
    to_dt: str
    out_name: str


def curl(args: list[str], out: Path, tries: int = 10, timeout: int = 180) -> str | None:
    out.parent.mkdir(parents=True, exist_ok=True)
    for i in range(tries):
        cmd = [
            "curl",
            "-sS",
            "--http1.1",
            "--tlsv1.2",
            "--max-time",
            str(timeout),
            "-A",
            UA,
            "-c",
            str(COOKIE),
            "-b",
            str(COOKIE),
            "-o",
            str(out),
            "-w",
            "%{http_code}",
            *args,
        ]
        p = subprocess.run(cmd, capture_output=True, text=True)
        code = (p.stdout or "").strip()
        err = (p.stderr or "").strip()[:160]
        size = out.stat().st_size if out.exists() else 0
        print(f"  try {i + 1}: http={code} size={size} err={err}", flush=True)
        if code.startswith("20") and size > 0:
            return code
        time.sleep(min(12.0, 1.4 * (i + 1)))
    return None


def warm_session(required: bool = True) -> bool:
    print("warming session…", flush=True)
    ok = curl([f"{BASE}/pt/xls/xls.do?mobileAt="], Path("/tmp/rtmolit-xls.html"), tries=14)
    if not ok and required:
        raise SystemExit("failed to open rt.molit.go.kr session")
    return bool(ok)


def read_jsessionid() -> str | None:
    if not COOKIE.exists():
        return None
    for line in COOKIE.read_text(encoding="utf-8", errors="ignore").splitlines():
        if "JSESSIONID" in line:
            return line.split("\t")[-1].strip()
    return None


def fetch_json(path: str, query: str = "") -> list[dict]:
    url = f"{BASE}{path}"
    if query:
        url += ("&" if "?" in path else "?") + query
    out = Path("/tmp/rtmolit-json.bin")
    ok = curl(
        [
            "-H",
            "X-Requested-With: XMLHttpRequest",
            "-H",
            f"Referer: {BASE}/pt/xls/xls.do?mobileAt=",
            url,
        ],
        out,
    )
    if not ok:
        raise RuntimeError(f"failed GET {url}")
    return json.loads(out.read_text(encoding="utf-8"))


def year_windows(years: int, end: date | None = None) -> list[tuple[str, str, str]]:
    """Return (label, from, to) calendar-year windows covering N+ years ending at `end`.

    Example for years=3 on 2026-07-28 → 2023,2024,2025 full years + 2026 YTD.
    """
    end = end or date.today()
    windows: list[tuple[str, str, str]] = []
    start_year = end.year - years
    for y in range(start_year, end.year):
        windows.append((str(y), f"{y}-01-01", f"{y}-12-31"))
    windows.append((str(end.year), f"{end.year}-01-01", end.isoformat()))
    return windows


def build_jobs(sido_cd: str, sido_nm: str, years: int) -> list[Job]:
    jobs: list[Job] = []
    for label, fr, to in year_windows(years):
        for kind, secd in (("sale", "1"), ("jeonse", "2")):
            _ = secd
            out = f"{sido_cd}_{kind}_{label}.csv"
            jobs.append(
                Job(
                    sido_cd=sido_cd,
                    sido_nm=sido_nm,
                    kind=kind,
                    from_dt=fr,
                    to_dt=to,
                    out_name=out,
                )
            )
    return jobs


def download_job(job: Job, force: bool = False) -> dict:
    dest = RAW_DIR / job.out_name
    meta = {
        "job": asdict(job),
        "path": str(dest.relative_to(ROOT)),
        "ok": False,
        "bytes": 0,
        "downloadedAt": None,
        "skipped": False,
        "error": None,
    }
    if dest.exists() and dest.stat().st_size > 1000 and not force:
        meta.update(ok=True, bytes=dest.stat().st_size, skipped=True)
        print(f"skip existing {dest.name} ({meta['bytes']} bytes)", flush=True)
        return meta

    if not COOKIE.exists() or not read_jsessionid():
        warm_session(required=True)
    jsid = read_jsessionid()
    secd = "1" if job.kind == "sale" else "2"
    fields = {
        "srhThingNo": "A",
        "srhDelngSecd": secd,
        "srhAddrGbn": "1",
        "srhLfstsSecd": "1",
        "sidoNm": job.sido_nm,
        "sggNm": "시군구 선택",
        "emdNm": "읍면동 선택",
        "loadNm": "도로명 선택",
        "areaNm": "전체",
        "hsmpNm": "단지 선택",
        "mobileAt": "",
        "srhFromDt": job.from_dt,
        "srhToDt": job.to_dt,
        "srhNewRonSecd": "",
        "srhSidoCd": job.sido_cd,
        "srhSggCd": "",
        "srhEmdCd": "",
        "srhRoadNm": "",
        "srhLoadCd": "",
        "srhHsmpCd": "",
        "srhArea": "",
        "srhFromAmount": "",
        "srhToAmount": "",
        "srhLrArea": "",
    }
    body = urllib.parse.urlencode(fields)
    url = f"{BASE}/pt/xls/ptXlsCSVDown.do"
    if jsid:
        url = f"{BASE}/pt/xls/ptXlsCSVDown.do;jsessionid={jsid}"
    print(f"download {job.out_name} ({job.kind} {job.from_dt}~{job.to_dt})", flush=True)
    args = [
        "-X",
        "POST",
        "-H",
        "Content-Type: application/x-www-form-urlencoded; charset=UTF-8",
        "-H",
        "X-Requested-With: XMLHttpRequest",
        "-H",
        f"Referer: {BASE}/pt/xls/xls.do?mobileAt=",
        "-H",
        f"Origin: {BASE}",
        "--data",
        body,
        url,
    ]
    code = curl(args, dest, tries=12, timeout=300)
    if not code:
        # session may have dropped; refresh once and retry
        warm_session(required=False)
        jsid = read_jsessionid()
        if jsid:
            args[-1] = f"{BASE}/pt/xls/ptXlsCSVDown.do;jsessionid={jsid}"
        code = curl(args, dest, tries=12, timeout=300)
    if not code:
        meta["error"] = "download failed"
        if dest.exists() and dest.stat().st_size < 1000:
            dest.unlink(missing_ok=True)
        return meta

    # Basic sanity: official exports are CP949; accept if header markers exist.
    raw = dest.read_bytes()
    text = None
    for enc in ("cp949", "euc-kr", "utf-8-sig", "utf-8"):
        try:
            text = raw[:8000].decode(enc)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        meta.update(error="undecodable", bytes=len(raw))
        return meta
    if "단지명" not in text and "보증금" not in text and "거래금액" not in text:
        meta.update(error="missing expected CSV header markers", bytes=len(raw))
        return meta

    meta.update(
        ok=True,
        bytes=len(raw),
        downloadedAt=datetime.now(timezone.utc).isoformat(),
    )
    return meta


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sido", default="11000", help="시도 코드 (서울=11000)")
    parser.add_argument("--sido-name", default="서울특별시")
    parser.add_argument("--years", type=int, default=3)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--list-sido", action="store_true")
    args = parser.parse_args()

    RAW_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST_DIR.mkdir(parents=True, exist_ok=True)

    warm_session(required=True)
    if args.list_sido:
        sido = fetch_json("/data/sido.do")
        print(json.dumps(sido, ensure_ascii=False, indent=2))
        return 0

    jobs = build_jobs(args.sido, args.sido_name, args.years)
    results = []
    for job in jobs:
        try:
            results.append(download_job(job, force=args.force))
        except Exception as exc:  # noqa: BLE001 - continue remaining jobs
            results.append(
                {
                    "job": asdict(job),
                    "path": str((RAW_DIR / job.out_name).relative_to(ROOT)),
                    "ok": False,
                    "bytes": 0,
                    "downloadedAt": None,
                    "skipped": False,
                    "error": str(exc),
                }
            )
        time.sleep(3)

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    manifest = {
        "createdAt": stamp,
        "source": "https://rt.molit.go.kr/pt/xls/xls.do",
        "sido": {"code": args.sido, "name": args.sido_name},
        "years": args.years,
        "results": results,
        "okCount": sum(1 for r in results if r["ok"]),
        "failCount": sum(1 for r in results if not r["ok"]),
    }
    path = MANIFEST_DIR / f"download-{args.sido}-{stamp}.json"
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"manifest": str(path.relative_to(ROOT)), **{k: manifest[k] for k in ("okCount", "failCount")}}, ensure_ascii=False))
    return 0 if manifest["failCount"] == 0 else 2


if __name__ == "__main__":
    sys.exit(main())
