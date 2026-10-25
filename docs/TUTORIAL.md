# Tutorial: from a Zillow link to a decision

This walks one real listing through the app, with the numbers the app actually produced on
2026-10-25. Property: **3727 Prairie Avenue, Centralia, WA 98531**, NWMLS #2593429, listed
$540,000, 3 bd / 2 ba / 1,545 sf on 0.94 acre.

## Step 1 - hand it the link

    node scout.js run "https://www.zillow.com/homedetails/3727-Prairie-Avenue-Centralia-WA-98531/61031189_zpid/"

The app reads the listing page and keeps the facts it needs: price, beds, baths, square feet,
county, HOA, tax rate, and the garage. It found the garage in the listing copy ("24' x 30' shop"),
so garage area came in at 720 sf - enough for three licensed bedrooms, not the two a 440 sf
garage would hold.

## Step 2 - the filter gate

    Filter gate: PASS (0 fails, 1 to confirm)
      confirm: Public sewer

Twelve checks run before any modelling. This one passed price ($450k-$550k), status, single
family, bedrooms and garage, with one open item: the listing does not say whether the home is on
public sewer. On a septic parcel the bedroom count means nothing until the health jurisdiction
confirms capacity (150 gallons per bedroom per day in Washington), so that is a phone call before
an offer, not after.

## Step 3 - the top 5 table

The app runs 25 combinations: five purchase prices ($450,000 to $550,000) against five rents
($3,500 to $6,000), each with the full cost stack - $20,000 of holding cost, $60,000 of remodel,
$10,000 of extra. Here is the top of that table:

| # | Scenario | Cash flow /mo | NPV @10% | IRR | Payback | ROI 5yr | Score | Judgement |
|---|---|---|---|---|---|---|---|---|
| 1 | $450,000 / $6,000 | +$1,748 | +$77,218 | 7.9% | none in 5 yr | 137% | 6.6 | CONDITIONAL |
| 2 | $475,000 / $6,000 | +$1,592 | +$70,391 | 6.9% | none in 5 yr | 133% | 5.9 | MARGINAL |
| 3 | $500,000 / $6,000 | +$1,435 | +$63,564 | 6.1% | none in 5 yr | 129% | 5.3 | MARGINAL |
| 4 | $525,000 / $6,000 | +$1,278 | +$56,737 | 5.2% | none in 5 yr | 125% | 4.9 | PASS |
| 5 | $450,000 / $5,375 | +$1,255 | +$45,857 | 4.7% | none in 5 yr | 122% | 4.6 | PASS |

How to read it:

- **Cash flow** is after debt service. At $450,000 with a $6,000 lease the home pays for itself
  and hands over $1,748 a month.
- **IRR** is only 7.9% on that same row, because most of the money comes back at the sale in year
  five and the 10% hurdle is missed. This is the tension the score exists to expose: a fat monthly
  cash flow does not make a 5-year IRR good.
- **Payback** says "none in 5 yr" because operating cash flow alone never returns the ~$202,000 of
  cash at risk - the equity comes back when the home is sold. That is normal for a levered
  purchase with $90,000 of conversion money in it, and it is why the payback column is not blank.
- **ROI 137%** is total profit over five years divided by cash at risk. It looks enormous next to a
  7.9% IRR because ROI counts principal paydown and appreciation, while IRR counts when the money
  arrives.
- **Score 6.6/10, CONDITIONAL**: the composite was 7.9, then cut 13% because the IRR is 2.1 points
  under the hurdle. The weakest link is named: return (IRR), 4.9/10.

## Step 4 - the grid

    price\rent         $3,500     $4,125     $4,750     $5,375     $6,000
    $450,000            0.8        1.7        3.2        4.6        6.6
    $475,000            0.6        1.4        2.9        4.2        5.9
    $500,000            0.5        1.2        2.6        3.7        5.3
    $525,000            0.4        0.8        1.7        3.2        4.9
    $550,000            0.4        0.7        1.5        3.0        4.4

The ridge runs down the right-hand column: rent does the heavy lifting, price decides whether the
deal survives. Only one cell in twenty-five clears 6.5.

## Step 5 - the levers

The report ends with the two numbers that matter in a negotiation:

- At the asking price of $540,000 the lease has to be **$6,675/mo** to reach 6.5/10.
- Holding rent at $6,000/mo, the purchase has to be **$455,000 or lower**. An $85,000 cut, worth
  about $533/mo of cash flow and 2.9 points of IRR.

That is the offer. Not $540,000 with a hope.

## Step 6 - the inspection gate

Before the $60,000 is spent, the WABO / DSHS list has to close: garage slab and header capacity,
an egress window per sleeping room (5.7 sf clear, 24 in high, sill at or below 44 in), 7 ft
ceilings, interconnected smoke and CO alarms, WSEC envelope values, heating sized for the added
rooms, parking and setbacks, and DSHS licensing reviewing the whole home rather than just the
conversion. Each item is printed with what it takes to pass, so a contractor can price it.

## Step 7 - let it run itself

    node scout.js monitor

Reads the NWMLS areas in `data/config.json`, drops everything it has seen before, screens what is
new, and only runs the full 25-scenario model for listings that clear the gate. On the test sweep
it read 60 listings across 98531 and 98532, kept 19 in the price band, 13 single family, 11 with
three or more bedrooms, and 3 passed the gate.

## What would turn this into a yes

A $455,000 purchase on this address, or a lease above $6,650/mo with a tenant already lined up.
Anything else is either the wrong house or the wrong price - and the app says which.

## Three ways to fool yourself

1. **Reading the high-rent rows as market rent.** A plain family rental on this home is around
   $1,984/mo (Zillow rental estimate). $6,000/mo is AFH-ready lease money and needs a licensee.
2. **Trusting garage square footage from listing copy.** The 24' x 30' here is described as a shop;
   if it is detached and the attached garage is a 20' x 20', capacity drops from three bedrooms to
   two. Measure before you model.
3. **Believing the composite without the return.** A 137% ROI with a 7.9% IRR is a cash-flow story,
   not a returns story. The score penalties exist to keep that honest.
