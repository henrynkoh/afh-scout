# Manual

## 1. What the app does

     NWMLS sweep  ->  filter gate  ->  25-scenario model  ->  top 5 + 1-10 judgement  ->  routine run
     (public site)    (buy box)       (price x rent)        (with evidence)              (daily, new only)

Nothing is fetched from a paid data provider. Listings come from the NWMLS public search pages,
property facts from the listing's Zillow page, and the mortgage rate from Freddie Mac.

## 2. Routine execution

`.github/workflows/daily-afh-monitor.yml` is the primary unattended routine. It schedules at both UTC offsets for Pacific time and a clock gate runs only at 7 AM locally, so daylight-saving changes do not create a second daily run. The job refreshes the rate, runs the monitor, rescales every saved candidate at its actual asking price, runs 17 controls, rebuilds the index, and commits `data/state.json`, `data/properties/`, and `out/`. The optional Mac fallback is `install-routine.sh`.

## 3. Commands

### `run <zillow-url | address | saved-id>`
The main command. Saves the property, screens it, runs all 25 combinations, writes
`out/<address>/report.md` and `report.html`, updates `data/properties/`, rebuilds the landing page,
and prints the top 5 table.

Flags:

| Flag | Effect |
|---|---|
| `--rent 4500` | Records the rent you believe this home will lease for (context only; the grid still runs 5 rents) |
| `--price 505000` | Analyses a negotiated price instead of the list price |
| `--garage-sf 520` | Overrides the garage area. Bedroom capacity depends on it: 690-736 sf holds 3, 500-689 holds 2, 400-460 holds 2 at best |
| `--county Lewis` | Overrides the county, which selects the tax rate |
| `--hoa 25` | Monthly HOA |
| `--beds 4` | Overrides the bedroom count |
| `--prices 450000,500000,550000` | Custom purchase ladder |
| `--rents 4000,5000,6000` | Custom rent ladder |

### `scan [--areas 98531,98532] [--limit 12]`
Reads the NWMLS areas in `data/config.json` (or the flag), keeps listings within +/-5% of the
price band, single family, at least 3 bedrooms, drops anything already seen, then enriches up to
`--limit` of them through Zillow and screens them. Prints a funnel and the passing table.

### `monitor`
`scan` plus: only properties not seen before get a full feasibility run, results go to
`out/monitor/<date>.md`, and the best new candidate is named at the end. This is what the daily
routine calls.

### `add`, `list`, `rescore`, `rate`, `index`, `selftest`
`add` saves a property without modelling it. `list` shows saved properties sorted by the actual asking-price score. `rescore` recalculates every saved passing home after a rate or assumption change.
`rate` pulls the latest 30-year fixed rate from FRED and writes it into the config.
`index` rebuilds `out/index.html`. `selftest` runs 17 assertions.

## 4. The numbers

**Financing.** Loan = price x (1 - 25%). Rate = Freddie Mac 30-yr FRM + 0.75 pt investor spread.
30-year amortisation. Monthly payment by standard annuity formula.

**Operating year (year 1, then grown).**

    gross rent       = rent x 12
    vacancy loss     = gross x 5%
    management       = gross x 8%
    maintenance      = gross x 8%
    property tax     = price x county levy (Thurston 0.95%, Lewis 0.87%)
    insurance        = $1,800/yr + 15% AFH liability uplift
    HOA              = listing HOA x 12
    NOI              = gross - vacancy - management - maintenance - tax - insurance - HOA
    cash flow        = NOI - annual debt service

**Cash at risk (year 0).** down payment + 2% closing + $20,000 holding + $60,000 remodel + $10,000 extra.
The $20,000 holding cost already contains the mortgage, tax, insurance and HOA for the six
conversion months, so those months are not counted twice.

**Exit.** Sale at price x 1.03^5, less 6% selling cost, less the loan balance at month 60.

**Metrics.**

| Metric | Definition |
|---|---|
| Cash flow | Year-1 monthly cash flow after debt service |
| NPV | Equity cash flows discounted at 10%: year 0 negative, years 1-5 operating, year 5 plus net sale |
| IRR | Levered IRR on the same flow (bisection, reported as n/a when no sign change) |
| Payback | Years of operating cash flow needed to return the equity; "no operational payback inside 5yr" when the equity only comes back at the sale |
| ROI | (5 years of cash flow + net sale proceeds - cash at risk) / cash at risk |
| Rent cushion | Rent / breakeven rent, where breakeven rent covers debt service plus fixed costs after vacancy, management and maintenance |
| DSCR | Year-1 NOI / annual debt service |

## 5. The 1-10 judgement

Six components, each scored 0-10 by piecewise-linear thresholds, then weighted:

| Component | Weight | 0 points | 5 points | 10 points |
|---|---|---|---|---|
| Cash flow /mo | 20% | -$600 | $0 | $1,500 |
| DSCR | 15% | 0.85 | 1.15 | 1.40 |
| IRR | 30% | -5% | 8% | 18% |
| Payback | 15% | 15 yr | 5 yr | 3 yr |
| ROI (5 yr) | 10% | -15% | 30% | 100% |
| Rent cushion | 10% | 0.80x | 1.00x | 1.30x |

Then two corrections, because a composite can flatter a bad return:

1. **IRR shortfall penalty.** If the IRR is under the 10% hurdle the score is multiplied by
   `1 - min(0.45, shortfall x 0.06)`, so 2 points short costs 12% and 7.5 points short costs 45%.
   Negative IRR or negative NPV caps the score at 4.0.
2. **No operational payback** multiplies by 0.95.

Verdict bands: **INVEST** score 7.5+ and IRR at or above the hurdle; **CONDITIONAL** 6.2+ and IRR
within 3 points of the hurdle; **MARGINAL** 5+; **PASS** everything else.

The report always names the weakest component ("weakest link") and, when the score was cut, says
by how much and why.

## 6. Filter gate

Hard fails stop a property: price outside $450,000-$550,000, not for sale, fewer than 3 bedrooms,
no garage, garage too small for two bedrooms. Items marked CHECK need a human answer before money
is spent: garage square footage not stated, sewer type, unknown county, HOA over $1,200/yr.

## 7. Config reference (`data/config.json`)

| Key | Meaning |
|---|---|
| `market.mortgage.rate_pct` | 30-yr FRM, refreshed by `node scout.js rate` |
| `market.mortgage.investment_spread_pct` | Investor-property premium over the FRM |
| `market.property_tax.by_county` | Levy as a fraction of price per county |
| `market.insurance.annual`, `.afh_uplift_pct` | Landlord policy and the AFH liability uplift |
| `market.vacancy_pct`, `management_pct`, `maintenance_pct` | Operating assumptions |
| `market.appreciation_pct`, `selling_cost_pct`, `rent_growth_pct`, `expense_growth_pct` | Hold assumptions |
| `market.discount_rate_pct` | NPV hurdle and the IRR benchmark |
| `market.down_payment_pct`, `closing_cost_pct`, `loan_term_years`, `hold_years` | Financing and hold |
| `deal.holding_cost`, `remodel`, `extra` | The three cost blocks in the formula |
| `scenarios.prices`, `scenarios.rents` | The 5 x 5 grid |
| `filters.*` | The buy box |
| `score_weights` | Judgement weights (must sum to 1) |
| `watch.areas` | NWMLS areas the sweep reads (zips or county slugs) |

Changing the grid to 3 x 5 or the hold to 7 years needs only a config edit; every table and
chart follows.

## 8. Data model

`data/properties/<key>.json` holds the property facts, the screen result and the last run summary
(`best_score`, `verdict`, `best_case`, `cash_needed`, `top`). `data/state.json` holds the seen
listing ids so `monitor` only reports new inventory.

## 9. Troubleshooting

- **A Zillow link returns no structured data.** Retry once; if it still fails, pass the address.
- **NWMLS returns 30 listings per area.** That is the newest page; the sweep is built for spotting
  new inventory, not for paging a whole county. Add more zips to `watch.areas` to widen coverage.
- **Garage square footage from listing text can be the detached shop.** The report prints the
  dimensions it used, so check them. `--garage-sf` overrides.
- **Zero passing candidates on a sweep** is a normal result and means the market, not the code.

## 10. Extending

- New county: add its levy to `market.property_tax.by_county` and its zips to `watch.areas`.
- New area shape: any NWMLS path works, e.g. `lewis-county`, `thurston-county-washington`, `98531`.
- Operator model (per-resident revenue instead of a whole-home lease): the revenue block is the
  single function `evaluate()` in `lib/scenarios.js`.
