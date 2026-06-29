# UI Icon Attribution

Pre-launch placeholder icons for the Talking Island vertical slice. Replace with
licensed art before go-live (AD-004).

| Asset | Source | License | Notes |
| ----- | ------ | ------- | ----- |
| All PNGs under `icons/` | Generated placeholder (`scripts/generate-p1-icons.py`) | Owned / replace before launch | Simple geometric glyphs — not L2 client rips |

## Regenerate placeholders

```bash
python3 scripts/generate-p1-icons.py
```

## Visual review sheet (icon lab)

```bash
nx build client
nx serve client --port=4201 &
LAB_BASE=http://localhost:4201 node scripts/shoot-icons.mjs
```

Output: `/tmp/icon-sheet.png` (override with `LAB_OUT`).
