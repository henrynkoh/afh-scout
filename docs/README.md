# afh-scout

A monitor and feasibility engine for one specific business: buying a NWMLS listing in
Lewis / Thurston County, converting the garage, and leasing the finished home to an adult
family home (AFH) operator as a long-term lease.

## Live links

- Live landing page: https://henrynkoh.github.io/afh-scout/
- GitHub repository: https://github.com/henrynkoh/afh-scout
- Real-property tutorial: https://github.com/henrynkoh/afh-scout/blob/main/docs/TUTORIAL.md

It answers three questions, in this order:

1. **Is this listing even worth analysing?** Filter gate: price band, single family, bedrooms,
   garage area, HOA, sewer, county tax table. Fail anything and it never reaches the model.
2. **What does the money look like across the whole market range?** 25 scenarios
   (5 purchase prices x 5 rents) scored on cash flow, NPV, IRR, payback, ROI and rent cushion,
   with the top 5 printed as a table and every combination shown as a grid.
3. **What has to be true for this to pass an inspection and a licence?** The WABO / DSHS gate
   lists the 12 items that decide whether the remodel is real work or a wish.

## The money formula

    all-in basis = purchase price
                 + holding cost      $20,000  (6 months of mortgage + tax + insurance + HOA)
                 + remodel           $60,000  (garage to AFH bedrooms)
                 + extra             $10,000  (contingency, permits, fees)

Cash at risk adds the down payment (25%) and closing (2%). Every metric is computed on that
cash, not on the purchase price.

## Automatic routine

GitHub Actions runs the monitor every day at **7:00 AM America/Los_Angeles**, refreshes the Freddie Mac rate, runs the NWMLS/Zillow funnel, verifies all 15 controls, and commits the updated state and reports back to the repository. `install-routine.sh` installs the same job on the Mac as an optional local fallback.

## Requirements

Node 22 (or any recent Node). Nothing else: no npm install, no key, no login.
`node scout.js selftest` runs 15 checks against the finance engine.

## Commands

| Goal | Command |
|---|---|
| Analyse one Zillow link | `node scout.js run "https://www.zillow.com/homedetails/..."` |
| Analyse a saved listing by address | `node scout.js run "1715 Ham Hill Road, Centralia, WA 98531"` |
| Sweep NWMLS now | `node scout.js scan` |
| Daily monitor (only new listings) | `node scout.js monitor` |
| Saved properties with last score | `node scout.js list` |
| Recalculate all saved homes at asking price | `node scout.js rescore` |
| Refresh the mortgage rate | `node scout.js rate` |
| Rebuild the landing page | `node scout.js index` |

## Where things land

- `out/index.html` - landing page: every screened property, its score, its report
- `out/<address>/report.html` - the feasibility report (tables plus charts)
- `out/<address>/report.md` - same content as markdown
- `out/monitor/<date>.md` - what the daily job found
- `data/properties/*.json` - everything the app knows about each property
- `data/config.json` - market factors, deal costs, scenario bands, score weights

## Sources

- Listings: NWMLS public search (`nwmls.com/homes-for-sale/...`), MLS number included
- Property facts and garage text: the Zillow listing page
- Mortgage rate: Freddie Mac PMMS through FRED (`node scout.js rate`)
- Tax rates: Washington county levy table in `data/config.json`

Not an appraisal, not financial advice, and the WABO / DSHS sections are checklists rather
than approvals.
