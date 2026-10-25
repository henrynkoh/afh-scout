'use strict';
const { money } = require('./scenarios');

const pct = (v, dp = 1) => (v == null ? 'n/a' : `${v.toFixed(dp)}%`);
const num = (v, dp = 2) => (v == null ? 'n/a' : v.toFixed(dp));

function basisRows(cfg, price) {
  const d = cfg.deal;
  const total = price + d.holding_cost + d.remodel + d.extra;
  return [
    ['Purchase price', price],
    [`Holding cost (${d.holding_months} mo: ${d.holding_covers.join(' + ')})`, d.holding_cost],
    ['Remodel for AFH conversion', d.remodel],
    ['Extra / contingency', d.extra],
    ['All-in basis', total],
  ];
}

function marketRows(cfg) {
  const m = cfg.market;
  return [
    ['Mortgage rate (30-yr FRM)', `${m.mortgage.rate_pct}% + ${m.mortgage.investment_spread_pct} pt investor spread`, m.mortgage.source],
    ['Property tax', `${(m.property_tax.rate_pct * 100).toFixed(2)}% of price (county table)`, m.property_tax.source],
    ['Insurance', `${money(m.insurance.annual)}/yr + ${(m.insurance.afh_uplift_pct * 100).toFixed(0)}% AFH uplift`, m.insurance.source],
    ['Vacancy / management / maintenance', `${m.vacancy_pct * 100}% / ${m.management_pct * 100}% / ${m.maintenance_pct * 100}%`, 'Market operating norms'],
    ['Appreciation / selling cost', `${m.appreciation_pct * 100}% / ${m.selling_cost_pct * 100}%`, 'Hold assumption'],
    ['Discount rate for NPV', `${m.discount_rate_pct * 100}%`, 'Hurdle rate'],
    ['Financing', `${m.down_payment_pct * 100}% down, ${m.loan_term_years}-yr amortisation, ${m.hold_years}-yr hold`, 'Investor loan market'],
  ];
}

function top5Markdown(grid, cfg) {
  const head = '| # | Scenario (price / rent) | Cash flow /mo | NPV @' + (cfg.market.discount_rate_pct * 100) + '% | IRR | Payback (yr) | ROI (5 yr) | Score /10 | Verdict | Reason and evidence |';
  const sep = '|---|---|---|---|---|---|---|---|---|---|';
  const rows = grid.top.map((t, i) => {
    return `| ${i + 1} | ${money(t.price)} / ${money(t.rent)} | ${money(t.cfMonthlyY1)} | ${money(t.npv)} | ${pct(t.irr)} | ${t.paybackYears == null ? '>10' : t.paybackYears.toFixed(1)} | ${pct(t.roi * 100, 0)} | **${t.score.toFixed(1)}** | ${t.verdict} | ${t.evidence}. Weakest link: ${t.binding} (${t.bindingScore.toFixed(1)}/10) |`;
  });
  return [head, sep, ...rows].join('\n');
}

function gridMarkdown(grid) {
  const head = `| Price \\ Rent | ${grid.rents.map((r) => money(r) + '/mo').join(' | ')} |`;
  const sep = '|---' + '|---'.repeat(grid.rents.length) + '|';
  const rows = grid.prices.map((price) => {
    const cells = grid.rents.map((rent) => {
      const r = grid.rows.find((x) => x.price === price && x.rent === rent);
      return `${r.score.toFixed(1)} (IRR ${pct(r.irr, 0)})`;
    });
    return `| **${money(price)}** | ${cells.join(' | ')} |`;
  });
  return [head, sep, ...rows].join('\n');
}

function screenMarkdown(screen) {
  const head = '| Filter | Result | Value | Rule |';
  const sep = '|---|---|---|---|';
  const rows = screen.checks.map((c) => `| ${c.name} | ${c.state === 'pass' ? 'PASS' : c.state === 'fail' ? '**FAIL**' : 'CHECK'} | ${c.value ?? 'n/a'} | ${c.rule} |`);
  return [head, sep, ...rows].join('\n');
}

const WABO_GATE = [
  ['Structural: garage slab and header capacity for habitable rooms', 'Engineer letter or prescriptive check; garage floors sit ~4in below finish floor', 'Open'],
  ['Egress: every AFH sleeping room needs an emergency escape window (5.7 sf clear, 24in high, 20in wide, sill <= 44in)', 'New sliders into the converted garage', 'Open'],
  ['Ceiling height >= 7ft in the conversion and hallway', 'Verify joist depth over the garage', 'Open'],
  ['Smoke / CO alarms per IRC R314/R315 plus WAC 388-76', 'Interconnected, photoelectric; LS-01 sheet', 'Open'],
  ['WSEC energy: envelope, insulation, glazing (U-factor)', 'Conversion wall/ceiling R-values and window U', 'Open'],
  ['Heating and ventilation sized for the added rooms', 'Manual J or equipment cut sheet', 'Open'],
  ['Plumbing fixture count and water heater location / seismic strapping', 'If bath added in the garage', 'Open'],
  ['Site: parking count, driveway turn-around, setbacks', 'AFH parking + survey coverage', 'Open'],
  ['Septic capacity if not on public sewer (150 gal/day per bedroom, WA OSS)', 'Health jurisdiction sign-off, not just the building department', 'Open'],
  ['DSHS licensing (WAC 388-76) reviews the WHOLE home, not just the conversion', 'Pre-licensing walkthrough before purchase', 'Open'],
  ['Zoning / land use allows an adult family home at this density', 'City or county planning confirmation', 'Open'],
  ['Utility capacity: electrical service, panel space for the added circuits', 'Panel photo at inspection', 'Open'],
];

function gateMarkdown() {
  return ['| WABO / AFH inspection item | What it takes to pass | Status |', '|---|---|---|', ...WABO_GATE.map((g) => `| ${g[0]} | ${g[1]} | ${g[2]} |`)].join('\n');
}

function rentReality(prop) {
  const z = prop.rent_zestimate;
  const rows = [];
  if (z) rows.push(['Zillow rental estimate (plain family rental)', money(z) + '/mo', 'Market data, no AFH premium']);
  rows.push(['AFH-ready whole-home lease (the grid axis)', 'rents ' + money(3500) + '-' + money(6000) + '/mo', 'Premium is earned by licensed capacity and an already-converted home']);
  rows.push(['AFH operator model (per resident)', 'not modelled in this run', 'Revenue = residents x rate x occupancy; a separate run']);
  return rows;
}

function nextActions(grid, screen, prop, cfg, deal) {
  const best = grid.top[0];
  const passing = grid.ranked.filter((r) => r.score >= cfg.filters.min_score);
  const acts = [];
  if (!screen.pass) acts.push(`Filter gate is not clean: ${screen.fails.join(', ') || 'no hard fails, but ' + screen.unknowns.length + ' unknown items'}. Confirm the unknowns before spending on due diligence.`);
  const target = cfg.filters.min_score;
  const listPrice = prop.price || grid.prices[2];
  const topRent = grid.rents[grid.rents.length - 1];
  if (passing.length) {
    acts.push(`Best combination is ${money(best.price)} purchase at ${money(best.rent)}/mo rent: ${best.score.toFixed(1)}/10 (${best.verdict}), ${money(best.cfMonthlyY1)}/mo cash flow, ${best.irr == null ? 'no measurable IRR' : best.irr.toFixed(1) + '% IRR'}. ${passing.length} of ${grid.rows.length} combinations clear ${target}/10.`);
  } else {
    acts.push(`No combination in the 5x5 grid clears ${target}/10 at today's factors. Best in-band result is ${best.score.toFixed(1)}/10 (${best.verdict}).`);
  }

  const { evaluate, rentForScore, priceForScore } = require('./scenarios');
  if (deal) {
    const rentNeeded = rentForScore(deal, cfg, listPrice, target);
    const priceNeeded = priceForScore(deal, cfg, topRent, target);
    if (rentNeeded) {
      acts.push(`At the asking price of ${money(listPrice)} the lease must be ${money(rentNeeded)}/mo to reach ${target}/10 (the grid tops out at ${money(topRent)}).`);
    } else {
      acts.push(`At ${money(listPrice)} this deal cannot reach ${target}/10 even at ${money(topRent)}/mo rent. The price has to move.`);
    }
    if (priceNeeded) {
      acts.push(`Holding rent at ${money(topRent)}/mo, the purchase has to be ${money(priceNeeded)} or lower. That is the offer number, not the asking price.`);
      const nowRow = evaluate(deal, cfg, listPrice, topRent);
      const thenRow = evaluate(deal, cfg, priceNeeded, topRent);
      const cut = listPrice - priceNeeded;
      if (cut > 0) {
        acts.push(`A cut of ${money(cut)} is worth ${money(thenRow.cfMonthlyY1 - nowRow.cfMonthlyY1)}/mo of cash flow and ${((thenRow.irr || 0) - (nowRow.irr || 0)).toFixed(1)} points of IRR versus the asking price.`);
      }
    }
  }
  const garageBeds = screen.garage_beds;
  if (garageBeds) acts.push(`Garage supports ${garageBeds} licensed bedrooms (${screen.garage_sf} sf). DSHS licensing counts the whole home, so the main-floor bedrooms are part of the capacity case.`);
  acts.push(`Before an offer: sewer/septic letter, garage slab and header check, and a DSHS pre-licensing walkthrough. Those three decide whether the ${money(cfg.deal.remodel)} remodel is real.`);
  acts.push('After an offer: the WABO plan review package (site plan, structural, energy, smoke/CO, mechanical) can be generated from the houseBIM toolchain so the conversion does not stall at inspection.');
  acts.push('Rent basis to confirm: the grid tests an AFH-ready whole-home lease. A plain family rental sits lower - see the rent reality section before trusting the high-rent rows.');
  return acts;
}

function buildMarkdown(ctx) {
  const { prop, screen, grid, cfg, runDate } = ctx;
  const basis = basisRows(cfg, prop.price || cfg.scenarios.prices[2]);
  const L = [];
  L.push(`# AFH feasibility: ${prop.address || 'property'}`);
  L.push('');
  L.push(`Run ${runDate} · ${prop.source} · ${prop.mls_id ? 'NWMLS #' + prop.mls_id + ' · ' : ''}${prop.url || ''}`);
  L.push('');
  L.push(`List price **${money(prop.price)}** · ${prop.beds ?? '?'} bd / ${prop.baths ?? '?'} ba · ${prop.sqft ?? '?'} sf · ${prop.year_built ?? '?'} built · ${prop.county || '?'} County · garage: ${prop.garage_yn ? 'yes' + (prop.garage_sf_est ? ' (~' + prop.garage_sf_est + ' sf' + (prop.garage_dims ? ', ' + prop.garage_dims : '') + ')' : '') : 'no / unknown'}`);
  L.push('');
  L.push('## 1. All-in basis');
  L.push('');
  L.push('| Line | Amount |');
  L.push('|---|---|');
  basis.forEach(([k, v]) => L.push(`| ${k} | ${money(v)} |`));
  L.push(`| Cash needed at ${cfg.market.down_payment_pct * 100}% down + closing | ${money(basis[4][1] * cfg.market.down_payment_pct + basis[0][1] * cfg.market.closing_cost_pct + cfg.deal.holding_cost + cfg.deal.remodel + cfg.deal.extra)} |`);
  L.push('');
  L.push('## 2. Market factors used');
  L.push('');
  L.push('| Factor | Value | Source |');
  L.push('|---|---|---|');
  marketRows(cfg).forEach(([k, v, s]) => L.push(`| ${k} | ${v} | ${s} |`));
  L.push('');
  L.push('## 3. Filter gate (stage 1)');
  L.push('');
  L.push(screenMarkdown(screen));
  L.push('');
  L.push(`Result: **${screen.pass ? 'PASS - worth a feasibility run' : 'FAIL - does not meet the buy box'}**`);
  L.push('');
  L.push('## 4. Top 5 scenario combinations');
  L.push('');
  L.push(`5 purchase prices (${cfg.scenarios.prices.map((p) => money(p)).join(' / ')}) x 5 rents (${cfg.scenarios.rents.map((r) => money(r)).join(' / ')}) = ${grid.rows.length} combinations, ranked by the composite score.`);
  L.push('');
  L.push(top5Markdown(grid, cfg));
  L.push('');
  L.push('## 5. Rent reality check');
  L.push('');
  L.push('| Basis | Value | Note |');
  L.push('|---|---|---|');
  rentReality(prop).forEach(([a, b, c]) => L.push(`| ${a} | ${b} | ${c} |`));
  L.push('');
  L.push('## 6. Full 25-combination grid (score and IRR)');
  L.push('');
  L.push(gridMarkdown(grid));
  L.push('');
  L.push('## 7. WABO / AFH inspection gate (stage 3, before the remodel)');
  L.push('');
  L.push(gateMarkdown());
  L.push('');
  L.push('## 8. Judgement and next actions');
  L.push('');
  nextActions(grid, screen, prop, cfg, ctx.deal).forEach((a) => L.push(`- ${a}`));
  L.push('');
  L.push('---');
  L.push('Model note: metrics are on the cash actually at risk (down payment, closing, holding, remodel, contingency). NPV discounts equity cash flows at the hurdle rate; IRR is the 5-year equity IRR including a sale at the assumed appreciation with 6% selling cost; payback counts operating cash flow first, then the exit.');
  return L.join('\n');
}

function barChart(items) {
  const w = 640, h = 220, pad = 34;
  const max = Math.max(...items.map((i) => i.value)) || 1;
  const bw = (w - pad * 2) / items.length - 14;
  const bars = items.map((it, i) => {
    const bh = Math.max(2, (it.value / max) * (h - 70));
    const x = pad + i * ((w - pad * 2) / items.length);
    const y = h - 40 - bh;
    const color = it.value >= 7.5 ? '#1f7a4d' : it.value >= 6.5 ? '#3d7ebf' : it.value >= 5 ? '#b8860b' : '#a33';
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${color}" rx="3"></rect>
      <text x="${(x + bw / 2).toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="middle" font-size="12" fill="#333">${it.value.toFixed(1)}</text>
      <text x="${(x + bw / 2).toFixed(1)}" y="${h - 22}" text-anchor="middle" font-size="11" fill="#555">${it.label}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img">${bars}</svg>`;
}

function heat(grid) {
  const cellColor = (s) => s >= 7.5 ? '#1f7a4d' : s >= 6.5 ? '#4a8fc9' : s >= 5 ? '#d9a422' : s >= 3 ? '#d97b2b' : '#a33';
  const head = grid.rents.map((r) => `<th>${money(r)}/mo</th>`).join('');
  const rows = grid.prices.map((price) => {
    const tds = grid.rents.map((rent) => {
      const r = grid.rows.find((x) => x.price === price && x.rent === rent);
      return `<td style="background:${cellColor(r.score)};color:#fff"><b>${r.score.toFixed(1)}</b><br><span class="t">IRR ${r.irr == null ? 'n/a' : r.irr.toFixed(0) + '%'}</span></td>`;
    }).join('');
    return `<tr><th>${money(price)}</th>${tds}</tr>`;
  }).join('');
  return `<table class="heat"><thead><tr><th>Price \\ Rent</th>${head}</tr></thead><tbody>${rows}</tbody></table>`;
}

function buildHtml(ctx) {
  const { prop, screen, grid, cfg, runDate } = ctx;
  const basis = basisRows(cfg, prop.price || cfg.scenarios.prices[2]);
  const cashNeeded = basis[4][1] * cfg.market.down_payment_pct + basis[0][1] * cfg.market.closing_cost_pct + cfg.deal.holding_cost + cfg.deal.remodel + cfg.deal.extra;
  const topRows = grid.top.map((t, i) => `<tr>
    <td class="rk">${i + 1}</td>
    <td><b>${money(t.price)}</b><br><span class="t">rent ${money(t.rent)}/mo</span></td>
    <td class="${t.cfMonthlyY1 >= 0 ? 'pos' : 'neg'}">${money(t.cfMonthlyY1)}</td>
    <td>${money(t.npv)}</td>
    <td>${pct(t.irr)}</td>
    <td>${t.paybackYears == null ? '&gt;10' : t.paybackYears.toFixed(1)}</td>
    <td>${pct(t.roi * 100, 0)}</td>
    <td class="score" style="background:${t.score >= 7.5 ? '#1f7a4d' : t.score >= 6.5 ? '#4a8fc9' : t.score >= 5 ? '#d9a422' : '#a33'}">${t.score.toFixed(1)}</td>
    <td><b>${t.verdict}</b></td>
    <td class="ev">${t.evidence}<br><span class="t">weakest link: ${t.binding} (${t.bindingScore.toFixed(1)}/10)</span></td>
  </tr>`).join('');

  const screenRows = screen.checks.map((c) => `<tr><td>${c.name}</td><td class="${c.state === 'pass' ? 'ok' : c.state === 'fail' ? 'bad' : 'warn'}">${c.state.toUpperCase()}</td><td>${c.value ?? 'n/a'}</td><td class="t">${c.rule}</td></tr>`).join('');
  const deal = ctx.deal;
  const gateRows = WABO_GATE.map((g) => `<tr><td>${g[0]}</td><td class="t">${g[1]}</td><td class="warn">${g[2]}</td></tr>`).join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AFH feasibility - ${prop.address || 'property'}</title>
<style>
:root{--ink:#16181d;--mut:#6b7280;--line:#e5e7eb;--bg:#fbfbfd;--card:#fff}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
.wrap{max-width:1160px;margin:0 auto;padding:28px 22px 80px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:34px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--line)}
.sub{color:var(--mut);font-size:13px;margin-bottom:18px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:16px 18px;margin:12px 0}
.kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}
.kv div span{display:block;color:var(--mut);font-size:12px}
.kv div b{font-size:17px}
table{width:100%;border-collapse:collapse;font-size:13.5px;background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden}
th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{background:#f4f5f8;font-size:12px;text-transform:uppercase;letter-spacing:.03em;color:#444}
.t{color:var(--mut);font-size:12px}
.pos{color:#1f7a4d;font-weight:600}.neg{color:#a33;font-weight:600}
.ok{color:#1f7a4d;font-weight:700}.bad{color:#a33;font-weight:700}.warn{color:#b8860b;font-weight:700}
.rk{font-weight:700;color:var(--mut)}
.score{color:#fff;font-weight:700;text-align:center}
.ev{min-width:260px}
.heat td,.heat th{text-align:center;padding:10px 6px}
#h{height:200px}
ul.acts li{margin:6px 0}
.foot{margin-top:36px;color:var(--mut);font-size:12px;border-top:1px solid var(--line);padding-top:12px}
a{color:#2563eb}
</style></head><body><div class="wrap">
<h1>${prop.address || 'Property'}</h1>
<div class="sub">AFH conversion feasibility · run ${runDate} · ${prop.source}${prop.mls_id ? ' · NWMLS #' + prop.mls_id : ''} · ${prop.url ? `<a href="${prop.url}">listing</a>` : ''}</div>

<div class="card kv">
  <div><span>List price</span><b>${money(prop.price)}</b></div>
  <div><span>Beds / baths / sqft</span><b>${prop.beds ?? '?'} / ${prop.baths ?? '?'} / ${prop.sqft ?? '?'}</b></div>
  <div><span>County</span><b>${prop.county || 'unknown'}</b></div>
  <div><span>Garage</span><b>${prop.garage_yn ? 'yes' : 'no/unknown'}${prop.garage_sf_est ? ' ~' + prop.garage_sf_est + ' sf' : ''}</b></div>
  <div><span>All-in basis</span><b>${money(basis[4][1])}</b></div>
  <div><span>Cash needed</span><b>${money(cashNeeded)}</b></div>
  <div><span>Best score</span><b>${grid.top[0].score.toFixed(1)}/10 · ${grid.top[0].verdict}</b></div>
</div>

<h2>1. All-in basis (the filter formula)</h2>
<table><thead><tr><th>Line</th><th>Amount</th></tr></thead><tbody>
${basis.map(([k, v]) => `<tr><td>${k}</td><td>${money(v)}</td></tr>`).join('')}
<tr><td>Cash at risk (${cfg.market.down_payment_pct * 100}% down + ${cfg.market.closing_cost_pct * 100}% closing + holding + remodel + contingency)</td><td><b>${money(cashNeeded)}</b></td></tr>
</tbody></table>

<h2>2. Filter gate</h2>
<table><thead><tr><th>Filter</th><th>Result</th><th>Value</th><th>Rule</th></tr></thead><tbody>${screenRows}</tbody></table>
<p class="sub">Gate result: <b>${screen.pass ? 'PASS - worth a feasibility run' : 'FAIL - outside the buy box'}</b>${screen.unknowns.length ? ' · ' + screen.unknowns.length + ' item(s) to confirm' : ''}</p>

<h2>3. Top 5 scenario combinations</h2>
<div class="card">${barChart(grid.top.map((t) => ({ label: money(t.price).replace('$', '') + '/' + money(t.rent).replace('$', ''), value: t.score })))}</div>
<table><thead><tr><th>#</th><th>Scenario</th><th>Cash flow /mo</th><th>NPV @${cfg.market.discount_rate_pct * 100}%</th><th>IRR</th><th>Payback yr</th><th>ROI 5yr</th><th>Score</th><th>Judgement</th><th>Reason and evidence</th></tr></thead><tbody>${topRows}</tbody></table>

<h2>4. Rent reality check</h2>
<table><thead><tr><th>Basis</th><th>Value</th><th>Note</th></tr></thead><tbody>
${rentReality(prop).map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td class="t">${c}</td></tr>`).join('')}
</tbody></table>

<h2>5. Full 25-combination grid</h2>
${heat(grid)}
<p class="sub">Green ${cfg.filters.min_score}+ = invest, blue 6.5+ = conditional, amber 5+ = marginal, red = pass.</p>

<h2>6. WABO / AFH inspection gate</h2>
<table><thead><tr><th>Item</th><th>What it takes</th><th>Status</th></tr></thead><tbody>${gateRows}</tbody></table>

<h2>7. Judgement and next actions</h2>
<div class="card"><ul class="acts">${nextActions(grid, screen, prop, cfg, deal).map((a) => `<li>${a}</li>`).join('')}</ul></div>

<h2>8. Market factors and sources</h2>
<table><thead><tr><th>Factor</th><th>Value</th><th>Source</th></tr></thead><tbody>
${marketRows(cfg).map(([k, v, s]) => `<tr><td>${k}</td><td>${v}</td><td class="t">${s}</td></tr>`).join('')}
</tbody></table>

<div class="foot">Generated by afh-scout · metrics on cash at risk · IRR includes exit at ${cfg.market.appreciation_pct * 100}%/yr appreciation with ${cfg.market.selling_cost_pct * 100}% selling cost · not an appraisal, not tax or legal advice.</div>
</div></body></html>`;
}

module.exports = { buildMarkdown, buildHtml, top5Markdown, gridMarkdown, WABO_GATE, basisRows, marketRows };
