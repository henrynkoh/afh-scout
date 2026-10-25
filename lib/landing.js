'use strict';
const fs = require('fs');
const path = require('path');
const { OUT, all } = require('./store');

function buildLanding(cfg, extra = {}) {
  const props = all().filter((p) => p.last_result || p.screen);
  const cards = props.map((p) => {
    const r = p.last_result || {};
    const slug = p.slug || (p.zpid ? 'zpid-' + p.zpid : null);
    const report = slug ? `./${slug}/report.html` : null;
    const score = r.best_score != null ? r.best_score.toFixed(1) : '-';
    const color = r.best_score >= 7.5 ? '#1f7a4d' : r.best_score >= 6.5 ? '#4a8fc9' : r.best_score >= 5 ? '#d9a422' : '#a33';
    return `<div class="card">
      <div class="row"><h3>${p.address || 'property'}</h3><span class="pill" style="background:${color}">${score}/10</span></div>
      <p class="t">${p.price ? '$' + Number(p.price).toLocaleString() : ''} · ${p.beds ?? '?'}bd/${p.baths ?? '?'}ba · ${p.sqft ?? '?'} sf · ${p.county || ''} County ${p.mls_id ? '· NWMLS #' + p.mls_id : ''}</p>
      <p class="t">${r.best_case || ''}</p>
      <div class="btns">
        ${report ? `<a class="btn" href="${report}">Feasibility report</a>` : ''}
        ${slug ? `<a class="btn ghost" href="./${slug}/report.md">Markdown</a>` : ''}
        ${p.url ? `<a class="btn ghost" href="${p.url}">Listing</a>` : ''}
      </div></div>`;
  }).join('');

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>afh-scout · NWMLS to AFH feasibility</title>
<style>
:root{--ink:#16181d;--mut:#6b7280;--line:#e5e7eb;--bg:#fbfbfd}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
.wrap{max-width:1080px;margin:0 auto;padding:34px 22px 80px}
h1{font-size:28px;margin:0 0 6px}h3{font-size:15px;margin:0}
.sub{color:var(--mut);font-size:14px;margin:0 0 22px}
h2{font-size:17px;margin:32px 0 10px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:14px}
.card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px}
.row{display:flex;align-items:center;justify-content:space-between;gap:10px}
.pill{color:#fff;font-weight:700;border-radius:999px;padding:2px 10px;font-size:12px}
.t{color:var(--mut);font-size:12.5px;margin:6px 0 0}
.btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.btn{display:inline-block;background:#16181d;color:#fff;text-decoration:none;padding:7px 13px;border-radius:8px;font-size:13px}
.btn.ghost{background:#fff;color:#16181d;border:1px solid #d5d7dd}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:13.5px}
td,th{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left}
th{background:#f4f5f8;font-size:12px;text-transform:uppercase;color:#444}
code{background:#f2f3f6;padding:1px 5px;border-radius:4px;font-size:12.5px}
.foot{color:var(--mut);font-size:12px;margin-top:34px;border-top:1px solid var(--line);padding-top:12px}
</style></head><body><div class="wrap">
<h1>afh-scout</h1>
<p class="sub">NWMLS sweep → filter → 25-scenario feasibility → the home worth converting for an AFH. Run ${extra.runDate || new Date().toISOString().slice(0, 10)} · rate ${cfg.market.mortgage.rate_pct}% + ${cfg.market.mortgage.investment_spread_pct} · all-in basis = price + $${cfg.deal.holding_cost.toLocaleString()} holding + $${cfg.deal.remodel.toLocaleString()} remodel + $${cfg.deal.extra.toLocaleString()} extra</p>

<h2>Properties screened (${props.length})</h2>
<div class="grid">${cards || '<p class="t">No properties yet. Add one with <code>node scout.js add &lt;zillow link&gt;</code></p>'}</div>

<h2>Docs</h2>
<div class="grid">
  <div class="card"><h3>Quickstart</h3><p class="t">One command to analyse a Zillow link.</p><div class="btns"><a class="btn" href="../docs/QUICKSTART.md">Open</a></div></div>
  <div class="card"><h3>Manual</h3><p class="t">Every command, every formula.</p><div class="btns"><a class="btn" href="../docs/MANUAL.md">Open</a></div></div>
  <div class="card"><h3>Tutorial</h3><p class="t">Walk a real listing end to end.</p><div class="btns"><a class="btn" href="../docs/TUTORIAL.md">Open</a></div></div>
  <div class="card"><h3>README</h3><p class="t">What this is and why.</p><div class="btns"><a class="btn" href="../docs/README.md">Open</a></div></div>
</div>

<h2>Command sheet</h2>
<table><thead><tr><th>Goal</th><th>Command</th></tr></thead><tbody>
<tr><td>Screen a specific home</td><td><code>node scout.js run "https://www.zillow.com/homedetails/..."</code></td></tr>
<tr><td>Sweep NWMLS now</td><td><code>node scout.js scan</code></td></tr>
<tr><td>Daily monitor run</td><td><code>node scout.js monitor</code></td></tr>
<tr><td>Refresh the mortgage rate</td><td><code>node scout.js rate</code></td></tr>
<tr><td>Rebuild this page</td><td><code>node scout.js index</code></td></tr>
</tbody></table>
<div class="foot">Metrics are on cash at risk. Not an appraisal, not financial advice. WABO / DSHS gates are checklists, not approvals.</div>
</div></body></html>`;
  fs.mkdirSync(path.join(OUT, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'index.html'), html);
  return path.join(OUT, 'index.html');
}

module.exports = { buildLanding };
