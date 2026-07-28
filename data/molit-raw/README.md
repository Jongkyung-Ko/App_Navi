# MOLIT file backfill (prep)

공식 **실거래가 공개시스템 자료제공** CSV로 과거 시세를 받아 정규화하는 준비 단계입니다.  
**아직 `/api/trades` 서빙 경로에는 연결하지 않습니다.**

## Source

- https://rt.molit.go.kr/pt/xls/xls.do
- 아파트 / 매매·전월세 / 시도 단위 / 기간 최대 1년
- 파일 인코딩: CP949

## Layout

```text
data/molit-raw/
  downloads/     # raw CSV (gitignored, large)
  fixtures/      # tiny CP949 samples for parser checks
  manifests/     # sido/sgg maps + download manifests
  reports/       # extract validation reports
data/molit-store/
  normalized/    # lawdCd/kind/YYYYMM.jsonl (gitignored)
scripts/backfill/
  rt_molit_download.py
  parse_rt_molit_csv.py
```

## Commands

```bash
# Seoul 3y+YTD (sale + jeonse) → data/molit-raw/downloads
python3 scripts/backfill/rt_molit_download.py --sido 11000 --sido-name 서울특별시 --years 3

# Parse + validate (+ write normalized buckets)
python3 scripts/backfill/parse_rt_molit_csv.py \
  --sgg-map data/molit-raw/manifests/sgg-seoul.json \
  --write
```

`safeForMerge: true` in the extract report means headers/mapping look safe enough to wire into the app.

## Serving in the app

1. Pack normalized buckets:
   ```bash
   tar -czf data/molit-store/seoul-normalized.tgz -C data/molit-store normalized
   ```
2. Docker/Railway image extracts this archive to `MOLIT_STORE_DIR`.
3. `/api/trades` reads store-first per `(lawdCd, month)`, then falls back to live MOLIT.

## Notes

- 전월세 파일의 월세>0 건은 앱과 동일하게 제외(순수 전세만).
- 해제사유발생일이 있는 건은 제외.
- 대용량 raw/normalized는 git에 올리지 않습니다. 압축본(`*.tgz`)만 커밋합니다.
