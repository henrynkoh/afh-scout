# Quickstart

Three steps. Each one is a single command, run from the app folder.

    cd ~/Documents/afh-scout

**1. Check the engine is healthy**

    node scout.js selftest

You should see `15/15 checks passed`.

**2. Analyse a Zillow link**

    node scout.js run "https://www.zillow.com/homedetails/3727-Prairie-Avenue-Centralia-WA-98531/61031189_zpid/"

Prints the filter gate, then the top 5 scenario table with cash flow, NPV, IRR, payback, ROI
and a 1-10 judgement. Writes `out/<address>/report.html` and refreshes `out/index.html`.

**3. Open the report**

    open ~/Documents/afh-scout/out/index.html

Every analysed property is a card there; click "Feasibility report".

## Day to day

The public repository already contains a scheduled GitHub Actions routine at 7:00 AM Pacific. It preserves the seen-listing and price state in the repo and updates the Pages reports.

For a local run:


    node scout.js monitor

Reads NWMLS for the watched areas, keeps only listings it has never seen, screens them, and
reports the ones that clear the gate. Run it from a scheduled job (the app ships with a daily
routine) or by hand before you call a broker.

## If something looks wrong

- `ERROR: no structured data` on a Zillow link: the page did not return its data block. Open the
  link in a browser once, then retry, or pass the address instead of the URL.
- A property shows `garage: yes` but no square footage: the listing did not state it. Re-run with
  `--garage-sf 520` once you have the number, because bedroom capacity depends on it.
- Numbers look too good: check the rent column you are reading. The grid tops out at $6,000/mo,
  which is AFH-ready lease money, not family-rental money.
