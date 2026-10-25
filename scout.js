#!/usr/bin/env node
'use strict';
// afh-scout: NWMLS sweep -> filter -> 25-scenario feasibility -> pick the home
// worth converting into an adult family home. Zero dependencies.

const fs = require('fs');
const path = require('path');
const store = require('./lib/store');
const zillow = require('./lib/zillow');
const nwmls = require('./lib/nwmls');
const { screenProperty } = require('./lib/screen');
const { runGrid, money, rentForScore, priceForScore } = require('./lib/scenarios');
const { buildMarkdown, buildHtml } = require('./lib/report');
const { buildLanding } = require('./lib/landing');
const { getText } = require('./lib/net');

const args = process.argv.slice(2);
const cmd = args[0];
const positional = args.slice(1).filter((a) => !a.startsWith('--'));
const flags = {};
for (let i = 1; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const k = args[i].replace(/^--/, '');
    const v = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : true;
    flags[k] = v;
  }
}
const today = () => new Date().toISOString().slice(0, 10);

function help() {
  console.log(`
afh-scout - NWMLS to adult family home feasibility

  node scout.js run <zillow-url | address | saved-slug> [--rent 4200] [--county Lewis] [--garage-sf 520] [--hoa 0]
        Full analysis: filter gate, 25 scenarios, top 5 table, WABO gate, HTML report.

  node scout.js add <zillow-url | address>
        Save a property without running the scenarios.

  node scout.js scan [--areas 98531,lewis-county] [--limit 12]
        Sweep NWMLS public listings, pre-filter the buy box, enrich with Zillow facts.

  node scout.js monitor [--areas ...] [--limit 12]
        Daily job: scan, diff against what was already seen, report only what is new.

  node scout.js list
        Saved properties and their last score.

  node scout.js rescore
        Recalculate every saved passing property at its actual asking price.

  node scout.js rate
        Pull the latest 30-year fixed rate (Freddie Mac via FRED) into the config.

  node scout.js index
        Rebuild out/index.html.

  node scout.js selftest
        Verify the finance engine and the scenario ranking.
`);
}

// ---------- shared pieces ----------
function dealFrom(prop, overrides = {}) {
  return {
    county: overrides.county || prop.county || 'Thurston',
    hoa_monthly: overrides.hoa != null ? Number(overrides.hoa) : (prop.hoa_monthly || 0),
  };
}

function withOverrides(prop, overrides) {
  const p = { ...prop };
  if (overrides.price) p.price = Number(overrides.price);
  if (overrides['garage-sf']) { p.garage_sf = Number(overrides['garage-sf']); p.garage_sf_est = Number(overrides['garage-sf']); }
  if (overrides.rent) p.rent_assumption = Number(overrides.rent);
  if (overrides.beds) p.beds = Number(overrides.beds);
  return p;
}

async function resolveProperty(target) {
  if (!target) throw new Error('Give a Zillow link, an address, or a saved property id.');
  if (/^https?:\/\//i.test(target) || (/\d/.test(target) && /,/.test(target) && !store.load(target))) {
    const p = await zillow.fetchProperty(target);
    store.save(p);
    return p;
  }
  const saved = store.load(target);
  if (!saved) throw new Error('No saved property matches ' + target);
  return saved;
}

function analyse(prop, cfg, overrides = {}) {
  const screened = screenProperty(prop, cfg);
  const deal = dealFrom(prop, overrides);
  const grid = runGrid(deal, cfg, {
    prices: flags.prices ? String(flags.prices).split(',').map(Number) : undefined,
    rents: flags.rents ? String(flags.rents).split(',').map(Number) : undefined,
    topN: 5,
  });
  const askingPrice = prop.price || cfg.scenarios.prices[2];
  const askingGrid = runGrid(deal, cfg, {
    prices: [askingPrice],
    rents: cfg.scenarios.rents,
    topN: 5,
  });
  const asking = askingGrid.top[0];
  const topRent = cfg.scenarios.rents[cfg.scenarios.rents.length - 1];
  const rentNeededAtAsk = rentForScore(deal, cfg, askingPrice, cfg.filters.min_score);
  const maxPriceAtTopRent = priceForScore(deal, cfg, topRent, cfg.filters.min_score);
  const slug = store.slugify(prop.address) || store.keyOf(prop);
  const runDate = today();
  const ctx = { prop, screen: screened, grid, asking, askingGrid, rentNeededAtAsk, maxPriceAtTopRent, cfg, runDate, deal };
  const dir = path.join(store.OUT, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'report.md'), buildMarkdown(ctx));
  fs.writeFileSync(path.join(dir, 'report.html'), buildHtml(ctx));
  const best = grid.top[0];
  const cashNeeded = (prop.price || cfg.scenarios.prices[2]) * (cfg.market.down_payment_pct + cfg.market.closing_cost_pct)
    + cfg.deal.holding_cost + cfg.deal.remodel + cfg.deal.extra;
  const updated = {
    ...prop,
    slug,
    screen: screened,
    last_result: {
      run_date: runDate,
      best_score: asking.score,
      verdict: asking.verdict,
      best_case: `At asking ${money(askingPrice)}, best tested rent ${money(asking.rent)}/mo -> score ${asking.score.toFixed(1)}/10, ${money(asking.cfMonthlyY1)}/mo cash flow, IRR ${asking.irr == null ? 'n/a' : asking.irr.toFixed(1) + '%'}`,
      asking_score: asking.score,
      asking_verdict: asking.verdict,
      asking_case: { price: askingPrice, rent: asking.rent, score: +asking.score.toFixed(2), npv: Math.round(asking.npv), irr: asking.irr == null ? null : +asking.irr.toFixed(2), cf_mo: Math.round(asking.cfMonthlyY1), roi_pct: +(asking.roi * 100).toFixed(1) },
      grid_best_score: best.score,
      grid_best_verdict: best.verdict,
      rent_needed_at_ask: rentNeededAtAsk,
      max_price_at_top_rent: maxPriceAtTopRent,
      cash_needed: Math.round(cashNeeded),
      passing_combos: grid.ranked.filter((r) => r.score >= cfg.filters.min_score).length,
      top: grid.top.map((t) => ({ price: t.price, rent: t.rent, score: +t.score.toFixed(2), irr: t.irr == null ? null : +t.irr.toFixed(2), cf_mo: Math.round(t.cfMonthlyY1) })),
    },
  };
  store.save(updated);
  return { ...ctx, updated, dir };
}

// ---------- commands ----------
async function cmdRun() {
  const cfg = store.readConfig();
  const prop = withOverrides(await resolveProperty(positional[0]), flags);
  const ctx = analyse(prop, cfg, flags);
  const { grid, screen, dir } = ctx;
  console.log('');
  console.log(`AFH feasibility - ${prop.address}  (${prop.price ? money(prop.price) : 'price unknown'})`);
  console.log(`Run ${ctx.runDate} | rate ${(cfg.market.mortgage.rate_pct + cfg.market.mortgage.investment_spread_pct).toFixed(2)}% | all-in = price + ${money(cfg.deal.holding_cost)} + ${money(cfg.deal.remodel)} + ${money(cfg.deal.extra)}`);
  console.log(`Filter gate: ${screen.pass ? 'PASS' : 'FAIL'} (${screen.fails.length} fails, ${screen.unknowns.length} to confirm)`);
  if (screen.fails.length) console.log('  fails: ' + screen.fails.join('; '));
  if (screen.unknowns.length) console.log('  confirm: ' + screen.unknowns.join('; '));
  console.log('');
  console.log(require('./lib/report').top5Markdown(grid, cfg));
  console.log('');
  console.log(`Report: ${path.join(dir, 'report.html')}`);
  console.log(`Index : ${buildLanding(cfg, { runDate: ctx.runDate })}`);
}

async function cmdAdd() {
  const cfg = store.readConfig();
  const prop = withOverrides(await zillow.fetchProperty(positional[0]), flags);
  const s = store.save(prop);
  const screened = screenProperty(prop, cfg);
  console.log(`Saved ${prop.address} -> ${s.key} (${screened.pass ? 'passes' : 'fails'} the filter gate)`);
}

async function cmdScan() {
  const cfg = store.readConfig();
  const areas = flags.areas ? String(flags.areas).split(',') : cfg.watch.areas;
  const limit = Number(flags.limit || 12);
  const f = cfg.filters;
  const state = store.readState();
  const seen = new Set(state.seen);
  const seenKey = (l) => String(l.mls_id || l.zpid) + '@' + (l.price || 0);

  const { listings, errors } = await nwmls.sweep(areas);
  const band = listings.filter((l) => l.price >= f.min_price * 0.95 && l.price <= f.max_price * 1.05);
  const sfr = band.filter((l) => /SINGLE FAMILY/i.test(String(l.type || '')));
  const sized = sfr.filter((l) => (l.beds || 0) >= f.min_beds);
  const fresh = sized.filter((l) => !seen.has(seenKey(l)));

  const enriched = [];
  for (const l of fresh.slice(0, limit)) {
    try {
      const z = await zillow.fetchProperty(`${l.address}`);
      const merged = { ...z, mls_id: l.mls_id || z.mls_id, nwmls_price: l.price, source_area: l.source_area, price: z.price || l.price };
      enriched.push(merged);
    } catch (e) {
      enriched.push({ ...l, enrich_error: e.message });
    }
  }
  const screened = enriched.map((p) => {
    const s = screenProperty(p, cfg);
    store.save({ ...p, screen: s });
    seen.add(seenKey(p));
    return { p, s };
  });

  state.seen = [...seen];
  state.prices = [...seen].map((k) => [k, Number(k.split('@')[1]) || 0]);
  state.last_scan = new Date().toISOString();
  store.writeState(state);

  const t = (label, n) => console.log(`  ${label.padEnd(34)} ${n}`);
  console.log(`NWMLS sweep: ${areas.length} areas, ${listings.length} listings read${errors.length ? `, ${errors.length} area errors` : ''}`);
  t('in price band (+/-5%)', band.length);
  t('single family', sfr.length);
  t(`${cfg.filters.min_beds}+ bedrooms`, sized.length);
  t('never seen before', fresh.length);
  t('enriched via Zillow', enriched.filter((p) => !p.enrich_error).length);
  t('pass filter gate', screened.filter((x) => x.s.pass).length);
  console.log('');
  const pass = screened.filter((x) => x.s.pass);
  if (pass.length) {
    console.log('| Property | Price | Beds | Garage | MLS | Score-ready |');
    console.log('|---|---|---|---|---|---|');
    for (const { p, s } of pass) {
      console.log(`| ${p.address} | ${p.price ? money(p.price) : '?'} | ${p.beds ?? '?'} | ${s.garage_sf ? s.garage_sf + ' sf' : (p.garage_yn ? 'yes' : '?')} | ${p.mls_id || '-'} | yes |`);
    }
    console.log('');
    console.log(`Next: node scout.js run "${pass[0].p.address}"`);
  } else {
    console.log('No new listing passes the gate this sweep.');
  }
  return { pass, screened, listings, areas };
}

async function cmdMonitor() {
  const cfg = store.readConfig();
  const before = store.readState();
  const beforeSeen = new Set(before.seen);
  const res = await cmdScan();
  const key = (p) => String(p.mls_id || p.zpid) + '@' + (p.price || 0);
  const news = res.pass.filter((x) => !beforeSeen.has(key(x.p)));
  if (!news.length) {
    console.log('');
    console.log(`Monitor ${today()}: nothing new worth analysing.`);
    return;
  }
  const scored = news.map(({ p }) => analyse(p, cfg, {}));
  scored.sort((a, b) => b.asking.score - a.asking.score || b.asking.irr - a.asking.irr);
  const leaders = scored.slice(0, 5);
  const topRent = cfg.scenarios.rents[cfg.scenarios.rents.length - 1];
  const lines = [`# Monitor ${today()} - ${news.length} new or price-changed candidate(s), all analysed`, ''];
  lines.push('## Top 5 properties at their actual asking prices');
  lines.push('');
  lines.push(`Ranked at the highest tested AFH-ready lease (${money(topRent)}/mo); each property report still contains the full 25-combination price/rent table.`);
  lines.push('');
  lines.push('| # | Property | Ask | Garage | Ask score | Verdict | Cash flow /mo | NPV | IRR | ROI | Rent needed at ask | Max price at top rent |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  leaders.forEach((ctx, i) => {
    const a = ctx.asking;
    const garage = ctx.screen.garage_sf ? `${ctx.screen.garage_sf} sf` : (ctx.prop.garage_yn ? 'yes, size check' : 'unknown');
    lines.push(`| ${i + 1} | ${ctx.prop.address} | ${money(ctx.prop.price)} | ${garage} | **${a.score.toFixed(1)}** | ${a.verdict} | ${money(a.cfMonthlyY1)} | ${money(a.npv)} | ${a.irr == null ? 'n/a' : a.irr.toFixed(1) + '%'} | ${(a.roi * 100).toFixed(0)}% | ${ctx.rentNeededAtAsk ? money(ctx.rentNeededAtAsk) + '/mo' : 'not reachable'} | ${ctx.maxPriceAtTopRent ? money(ctx.maxPriceAtTopRent) : 'not reachable'} |`);
  });
  lines.push('');
  for (const ctx of leaders) {
    const p = ctx.prop;
    lines.push(`## ${p.address} - ${money(p.price)}`);
    lines.push('');
    lines.push(`At asking price: ${ctx.asking.score.toFixed(1)}/10 (${ctx.asking.verdict}) · ${ctx.asking.evidence}`);
    lines.push('');
    lines.push(require('./lib/report').top5Markdown(ctx.grid, cfg));
    lines.push('');
  }
  const dir = path.join(store.OUT, 'monitor');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `${today()}.md`);
  fs.writeFileSync(f, lines.join('\n'));
  buildLanding(cfg, { runDate: today() });
  console.log('');
  console.log(`Wrote ${f}`);
  const best = leaders[0];
  console.log(`Best new candidate at asking price: ${best.prop.address} - ${best.asking.score.toFixed(1)}/10 (${best.asking.verdict})`);
}

async function cmdRescore() {
  const cfg = store.readConfig();
  const props = store.all().filter((p) => p.screen ? p.screen.pass : screenProperty(p, cfg).pass);
  if (!props.length) {
    buildLanding(cfg, { runDate: today() });
    console.log('No saved passing properties to rescore.');
    return [];
  }
  const rows = props.map((p) => analyse(p, cfg, {}));
  rows.sort((a, b) => b.asking.score - a.asking.score || ((b.asking.irr ?? -99) - (a.asking.irr ?? -99)));
  console.log('| # | Property | Ask | Rent tested | Ask score | Verdict | IRR | Cash flow /mo |');
  console.log('|---|---|---|---|---|---|---|---|');
  rows.forEach((ctx, i) => console.log(`| ${i + 1} | ${ctx.prop.address} | ${money(ctx.prop.price)} | ${money(ctx.asking.rent)}/mo | ${ctx.asking.score.toFixed(1)} | ${ctx.asking.verdict} | ${ctx.asking.irr == null ? 'n/a' : ctx.asking.irr.toFixed(1) + '%'} | ${money(ctx.asking.cfMonthlyY1)} |`));
  buildLanding(cfg, { runDate: today() });
  return rows;
}

async function cmdList() {
  const props = store.all();
  if (!props.length) return console.log('No saved properties yet.');
  console.log('| Property | Price | Beds | County | Gate | Best score | Verdict |');
  console.log('|---|---|---|---|---|---|---|');
  for (const p of props.sort((a, b) => (b.last_result?.best_score || 0) - (a.last_result?.best_score || 0))) {
    const lr = p.last_result || {};
    console.log(`| ${p.address} | ${p.price ? money(p.price) : '?'} | ${p.beds ?? '?'} | ${p.county || '?'} | ${p.screen ? (p.screen.pass ? 'pass' : 'fail') : '-'} | ${lr.best_score != null ? lr.best_score.toFixed(1) : '-'} | ${lr.verdict || '-'} |`);
  }
}

async function cmdRate() {
  const cfg = store.readConfig();
  const { text } = await getText('https://fred.stlouisfed.org/graph/fredgraph.csv?id=MORTGAGE30US');
  const rows = text.trim().split('\n').slice(1).map((l) => l.split(',')).filter((r) => r[1] && r[1] !== '.');
  const last = rows[rows.length - 1];
  cfg.market.mortgage.rate_pct = Number(last[1]);
  cfg.market.mortgage.source = `Freddie Mac PMMS ${last[0]} (${last[1]}%) + ${cfg.market.mortgage.investment_spread_pct}pt investor spread`;
  cfg.as_of = last[0];
  store.writeConfig(cfg);
  console.log(`30-yr FRM ${last[1]}% as of ${last[0]} -> investor rate ${(Number(last[1]) + cfg.market.mortgage.investment_spread_pct).toFixed(2)}%`);
}

function cmdIndex() {
  const cfg = store.readConfig();
  console.log(buildLanding(cfg, { runDate: today() }));
}

function cmdSelftest() {
  const cfg = store.readConfig();
  const { pmt, irr, npv } = require('./lib/finance');
  const results = [];
  const ok = (name, cond, detail = '') => results.push({ name, pass: !!cond, detail });

  const p = pmt(8.07, 30, 400000);
  ok('amortisation payment sanity', p > 2900 && p < 3100, `$${p.toFixed(0)}/mo on $400k @8.07%`);
  ok('IRR of a known cash flow', Math.abs(irr([-100, 0, 0, 0, 0, 200]) - 14.87) < 0.2, `${irr([-100, 0, 0, 0, 0, 200]).toFixed(2)}% vs 14.87%`);
  ok('NPV zero at IRR', Math.abs(npv(irr([-100, 50, 60]), [-100, 50, 60])) < 0.01, 'npv(irr)=0');

  const g = runGrid({ county: 'Lewis', hoa_monthly: 0 }, cfg);
  ok('25 combinations built', g.rows.length === 25, `${g.rows.length} rows`);
  ok('top 5 returned', g.top.length === 5);
  ok('ranking is monotonic', g.ranked.every((r, i) => i === 0 || g.ranked[i - 1].score >= r.score));
  ok('cheaper price scores higher at fixed rent', g.rows[0].score >= g.rows.find((r) => r.price === 550000 && r.rent === g.rows[0].rent).score);
  ok('higher rent scores higher at fixed price', g.rows.find((r) => r.price === 450000 && r.rent === 6000).score > g.rows.find((r) => r.price === 450000 && r.rent === 3500).score);
  ok('all-in basis = price + 90k', g.rows[0].allInBasis === 450000 + 90000, money(g.rows[0].allInBasis));
  ok('negative cash flow on the worst combo', g.rows.find((r) => r.price === 550000 && r.rent === 3500).cfMonthlyY1 < 0);
  ok('scores stay inside 0-10', g.rows.every((r) => r.score >= 0 && r.score <= 10));

  // Invariants that catch scoring discontinuities: dearer must never score better
  // at the same rent, and a higher rent must never score worse at the same price.
  let priceViolations = [];
  for (let i = 1; i < g.prices.length; i++) {
    for (const rent of g.rents) {
      const a = g.rows.find((r) => r.price === g.prices[i - 1] && r.rent === rent);
      const b = g.rows.find((r) => r.price === g.prices[i] && r.rent === rent);
      if (b.score > a.score + 1e-9) priceViolations.push(`${g.prices[i]}/${rent}`);
    }
  }
  ok('score never improves as price rises', priceViolations.length === 0, priceViolations.slice(0, 3).join(' '));

  let rentViolations = [];
  for (let i = 1; i < g.rents.length; i++) {
    for (const price of g.prices) {
      const a = g.rows.find((r) => r.price === price && r.rent === g.rents[i - 1]);
      const b = g.rows.find((r) => r.price === price && r.rent === g.rents[i]);
      if (b.score < a.score - 1e-9) rentViolations.push(`${g.rents[i]}/${price}`);
    }
  }
  ok('score never falls as rent rises', rentViolations.length === 0, rentViolations.slice(0, 3).join(' '));

  const levers = require('./lib/scenarios');
  const rentNeeded = levers.rentForScore({ county: 'Lewis' }, cfg, 500000, cfg.filters.min_score);
  ok('rent lever solves above the grid', rentNeeded != null && rentNeeded > 0, rentNeeded ? '$' + rentNeeded + '/mo at $500k' : 'no solution');
  const priceNeeded = levers.priceForScore({ county: 'Lewis' }, cfg, 5000, cfg.filters.min_score);
  ok('price lever solves', priceNeeded != null && priceNeeded < 550000, priceNeeded ? '$' + priceNeeded + ' at $5,000/mo' : 'no solution');

  let fails = 0;
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? '  (' + r.detail + ')' : ''}`);
    if (!r.pass) fails++;
  }
  console.log(`\n${results.length - fails}/${results.length} checks passed`);
  process.exitCode = fails ? 1 : 0;
}

(async () => {
  try {
    if (!cmd || cmd === 'help' || cmd === '--help') return help();
    if (cmd === 'run') return await cmdRun();
    if (cmd === 'add') return await cmdAdd();
    if (cmd === 'scan') return await cmdScan();
    if (cmd === 'monitor') return await cmdMonitor();
    if (cmd === 'list') return await cmdList();
    if (cmd === 'rescore') return await cmdRescore();
    if (cmd === 'rate') return await cmdRate();
    if (cmd === 'index') return cmdIndex();
    if (cmd === 'selftest') return cmdSelftest();
    help();
  } catch (e) {
    console.error('ERROR: ' + e.message);
    process.exitCode = 1;
  }
})();
