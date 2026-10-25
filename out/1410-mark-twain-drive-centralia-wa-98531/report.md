# AFH feasibility: 1410 Mark Twain Drive, Centralia, WA 98531

Run 2026-10-25 · Zillow · NWMLS #2590821 · https://www.zillow.com/homedetails/1410-Mark-Twain-Dr-Centralia-WA-98531/89018133_zpid/

List price **$525,000** · 3 bd / 2 ba · 1440 sf · ? built · Lewis County · garage: yes

## 1. All-in basis

| Line | Amount |
|---|---|
| Purchase price | $525,000 |
| Holding cost (6 mo: mortgage + tax + insurance + HOA) | $20,000 |
| Remodel for AFH conversion | $60,000 |
| Extra / contingency | $10,000 |
| All-in basis | $615,000 |
| Cash needed at 25% down + closing | $231,750 |

## 2. Market factors used

| Factor | Value | Source |
|---|---|---|
| Mortgage rate (30-yr FRM) | 7.32% + 0.75 pt investor spread | Freddie Mac PMMS 2026-10-22 (7.32%) + 0.75pt investor spread |
| Property tax | 0.95% of price (county table) | WA DOR 2026 effective levy, county average |
| Insurance | $1,800/yr + 15% AFH uplift | WA landlord policy avg 2026, +15% AFH liability uplift |
| Vacancy / management / maintenance | 5% / 8% / 8% | Market operating norms |
| Appreciation / selling cost | 3% / 6% | Hold assumption |
| Discount rate for NPV | 10% | Hurdle rate |
| Financing | 25% down, 30-yr amortisation, 5-yr hold | Investor loan market |

## 3. Filter gate (stage 1)

| Filter | Result | Value | Rule |
|---|---|---|---|
| Listing price inside scenario band | PASS | 525000 | $450,000 - $550,000 |
| Actively for sale | PASS | FOR_SALE | Active / coming soon |
| Single-family residence | PASS | SINGLE_FAMILY | Detached house (AFH occupancy) |
| Bedrooms for the existing home | PASS | 3 | >= 3 bd in main home |
| Garage to convert | CHECK | Attached Garage, RV Parking | Measured >= 400 sf garage (2 bedrooms needs ~500-689 sf, 3 needs ~690-736 sf) |
| HOA carry | PASS | none | <= $1,200/yr |
| Public sewer | CHECK | not stated | Public sewer preferred; septic needs health jurisdiction capacity sign-off |
| County tax rate known | PASS | Lewis | Thurston / Lewis levy table |

Result: **PASS - worth a feasibility run**

## 4. Asking-price decision

| Ask | Best tested rent | Cash flow /mo | NPV | IRR | Operational payback | ROI | Score | Verdict |
|---|---|---|---|---|---|---|---|---|
| $525,000 | $6,000/mo | $1,278 | $56,737 | 5.2% | >5 years (equity returns at exit) | 125% | **4.9** | PASS |

Thresholds: **$6,550/mo rent required at asking** · **$455,000 maximum price at $6,000/mo rent**.

## 5. Top 5 scenario combinations

5 purchase prices ($450,000 / $475,000 / $500,000 / $525,000 / $550,000) x 5 rents ($3,500 / $4,125 / $4,750 / $5,375 / $6,000) = 25 combinations, ranked by the composite score.

| # | Scenario (price / rent) | Cash flow /mo | NPV @10% | IRR | Payback (yr) | ROI (5 yr) | Score /10 | Verdict | Reason and evidence |
|---|---|---|---|---|---|---|---|---|---|
| 1 | $450,000 / $6,000 | $1,748 | $77,218 | 7.9% | >5 (exit) | 137% | **6.6** | CONDITIONAL | +$1,748/mo after debt · DSCR 1.70 · IRR 7.9% · no operational payback inside 5yr (equity returns at sale, yr 5) · ROI 137% · rent vs breakeven $3,787 (x1.58) · score adjustment: IRR 7.9% is 2.1 pt under the 10% hurdle (-13% on the score). Weakest link: return (IRR) (4.9/10) |
| 2 | $475,000 / $6,000 | $1,592 | $70,391 | 6.9% | >5 (exit) | 133% | **5.9** | MARGINAL | +$1,592/mo after debt · DSCR 1.60 · IRR 6.9% · no operational payback inside 5yr (equity returns at sale, yr 5) · ROI 133% · rent vs breakeven $3,985 (x1.51) · score adjustment: IRR 6.9% is 3.1 pt under the 10% hurdle (-18% on the score). Weakest link: return (IRR) (3.9/10) |
| 3 | $500,000 / $6,000 | $1,435 | $63,564 | 6.1% | >5 (exit) | 129% | **5.3** | MARGINAL | +$1,435/mo after debt · DSCR 1.52 · IRR 6.1% · no operational payback inside 5yr (equity returns at sale, yr 5) · ROI 129% · rent vs breakeven $4,183 (x1.43) · score adjustment: IRR 6.1% is 3.9 pt under the 10% hurdle (-24% on the score). Weakest link: return (IRR) (3.1/10) |
| 4 | $525,000 / $6,000 | $1,278 | $56,737 | 5.2% | >5 (exit) | 125% | **4.9** | PASS | +$1,278/mo after debt · DSCR 1.44 · IRR 5.2% · no operational payback inside 5yr (equity returns at sale, yr 5) · ROI 125% · rent vs breakeven $4,382 (x1.37) · score adjustment: IRR 5.2% is 4.8 pt under the 10% hurdle (-29% on the score). Weakest link: return (IRR) (2.7/10) |
| 5 | $450,000 / $5,375 | $1,255 | $45,857 | 4.7% | >5 (exit) | 122% | **4.6** | PASS | +$1,255/mo after debt · DSCR 1.50 · IRR 4.7% · no operational payback inside 5yr (equity returns at sale, yr 5) · ROI 122% · rent vs breakeven $3,787 (x1.42) · score adjustment: IRR 4.7% is 5.3 pt under the 10% hurdle (-32% on the score). Weakest link: return (IRR) (2.5/10) |

## 6. Rent reality check

| Basis | Value | Note |
|---|---|---|
| AFH-ready whole-home lease (the grid axis) | rents $3,500-$6,000/mo | Premium is earned by licensed capacity and an already-converted home |
| AFH operator model (per resident) | not modelled in this run | Revenue = residents x rate x occupancy; a separate run |

## 7. Full 25-combination grid (score and IRR)

| Price \ Rent | $3,500/mo | $4,125/mo | $4,750/mo | $5,375/mo | $6,000/mo |
|---|---|---|---|---|---|
| **$450,000** | 0.8 (IRR -5%) | 1.7 (IRR -2%) | 3.2 (IRR 2%) | 4.6 (IRR 5%) | 6.6 (IRR 8%) |
| **$475,000** | 0.6 (IRR -5%) | 1.4 (IRR -2%) | 2.9 (IRR 1%) | 4.2 (IRR 4%) | 5.9 (IRR 7%) |
| **$500,000** | 0.5 (IRR -6%) | 1.2 (IRR -3%) | 2.6 (IRR 0%) | 3.7 (IRR 3%) | 5.3 (IRR 6%) |
| **$525,000** | 0.4 (IRR -6%) | 0.8 (IRR -3%) | 1.7 (IRR -0%) | 3.2 (IRR 2%) | 4.9 (IRR 5%) |
| **$550,000** | 0.4 (IRR -7%) | 0.7 (IRR -4%) | 1.5 (IRR -1%) | 3.0 (IRR 2%) | 4.4 (IRR 4%) |

## 8. WABO / AFH inspection gate (stage 3, before the remodel)

| WABO / AFH inspection item | What it takes to pass | Status |
|---|---|---|
| Structural: garage slab and header capacity for habitable rooms | Engineer letter or prescriptive check; garage floors sit ~4in below finish floor | Open |
| Egress: every AFH sleeping room needs an emergency escape window (5.7 sf clear, 24in high, 20in wide, sill <= 44in) | New sliders into the converted garage | Open |
| Ceiling height >= 7ft in the conversion and hallway | Verify joist depth over the garage | Open |
| Smoke / CO alarms per IRC R314/R315 plus WAC 388-76 | Interconnected, photoelectric; LS-01 sheet | Open |
| WSEC energy: envelope, insulation, glazing (U-factor) | Conversion wall/ceiling R-values and window U | Open |
| Heating and ventilation sized for the added rooms | Manual J or equipment cut sheet | Open |
| Plumbing fixture count and water heater location / seismic strapping | If bath added in the garage | Open |
| Site: parking count, driveway turn-around, setbacks | AFH parking + survey coverage | Open |
| Septic capacity if not on public sewer (150 gal/day per bedroom, WA OSS) | Health jurisdiction sign-off, not just the building department | Open |
| DSHS licensing (WAC 388-76) reviews the WHOLE home, not just the conversion | Pre-licensing walkthrough before purchase | Open |
| Zoning / land use allows an adult family home at this density | City or county planning confirmation | Open |
| Utility capacity: electrical service, panel space for the added circuits | Panel photo at inspection | Open |

## 9. Judgement and next actions

- Best combination is $450,000 purchase at $6,000/mo rent: 6.6/10 (CONDITIONAL), $1,748/mo cash flow, 7.9% IRR. 1 of 25 combinations clear 6.5/10.
- At the asking price of $525,000 the lease must be $6,550/mo to reach 6.5/10 (the grid tops out at $6,000).
- Holding rent at $6,000/mo, the purchase has to be $455,000 or lower. That is the offer number, not the asking price.
- A cut of $70,000 is worth $439/mo of cash flow and 2.5 points of IRR versus the asking price.
- Before an offer: sewer/septic letter, garage slab and header check, and a DSHS pre-licensing walkthrough. Those three decide whether the $60,000 remodel is real.
- After an offer: the WABO plan review package (site plan, structural, energy, smoke/CO, mechanical) can be generated from the houseBIM toolchain so the conversion does not stall at inspection.
- Rent basis to confirm: the grid tests an AFH-ready whole-home lease. A plain family rental sits lower - see the rent reality section before trusting the high-rent rows.

---
Model note: metrics are on the cash actually at risk (down payment, closing, holding, remodel, contingency). NPV discounts equity cash flows at the hurdle rate; IRR is the 5-year equity IRR including a sale at the assumed appreciation with 6% selling cost; payback counts operating cash flow first, then the exit.