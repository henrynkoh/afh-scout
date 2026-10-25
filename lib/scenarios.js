'use strict';
const { pmt, balanceAfter, npv, irr, paybackYears } = require('./finance');

// Piecewise-linear score map: points = [[x, score], ...] ascending in x.
function curve(points, x) {
  if (x == null || !isFinite(x)) return 0;
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x0, s0] = points[i - 1];
    const [x1, s1] = points[i];
    if (x <= x1) return s0 + ((x - x0) / (x1 - x0)) * (s1 - s0);
  }
  return points[points.length - 1][1];
}

const MAPS = {
  cash_flow: [[-600, 0], [-200, 1.5], [0, 4], [400, 6.5], [800, 8.5], [1500, 10]],
  dscr: [[0.85, 0], [1.0, 2], [1.15, 5], [1.25, 8], [1.4, 10]],
  irr: [[-5, 0], [0, 0.5], [6, 3], [8, 5], [12, 8], [18, 10]],
  payback: [[3, 10], [4, 9], [5, 7.5], [6, 6], [8, 3], [10, 1], [15, 0]],
  roi: [[-15, 0], [0, 2], [30, 5], [60, 8], [100, 10]],
  rent_cushion: [[0.8, 0], [0.9, 2], [1.0, 5], [1.15, 8], [1.3, 10]],
};

function taxesFor(config, county, price) {
  const byCounty = config.market.property_tax.by_county || {};
  const rate = (county && byCounty[county] != null) ? byCounty[county] : config.market.property_tax.rate_pct;
  return { rate, annual: price * rate };
}

// One (price, rent) combination -> full metric set.
function evaluate(deal, cfg, price, rent) {
  const m = cfg.market;
  const rate = m.mortgage.rate_pct + m.mortgage.investment_spread_pct;
  const holdYears = m.hold_years;
  const down = price * m.down_payment_pct;
  const loan = price - down;
  const debtServiceAnnual = pmt(rate, m.loan_term_years, loan) * 12;
  const closing = price * m.closing_cost_pct;
  const tax = taxesFor(cfg, deal.county, price);
  const insurance = m.insurance.annual * (1 + m.insurance.afh_uplift_pct);
  const hoa = (deal.hoa_monthly || 0) * 12;
  const grossRentAnnual = rent * 12;
  const vacancyLoss = grossRentAnnual * m.vacancy_pct;
  const mgmt = grossRentAnnual * m.management_pct;
  const maint = grossRentAnnual * m.maintenance_pct;

  const equity0 = down + closing + cfg.deal.holding_cost + cfg.deal.remodel + cfg.deal.extra;

  const flows = [-equity0];
  const opFlows = [];
  let noiY1 = null;
  for (let y = 1; y <= holdYears; y++) {
    const g = Math.pow(1 + m.rent_growth_pct, y - 1);
    const e = Math.pow(1 + m.expense_growth_pct, y - 1);
    const gross = grossRentAnnual * g;
    const noi = gross * (1 - m.vacancy_pct - m.management_pct - m.maintenance_pct)
      - tax.annual * e - insurance * e - hoa * e;
    if (y === 1) noiY1 = noi;
    const cf = noi - debtServiceAnnual;
    opFlows.push(cf);
    flows.push(cf);
  }
  const salePrice = price * Math.pow(1 + m.appreciation_pct, holdYears);
  const sellingCosts = salePrice * m.selling_cost_pct;
  const loanBal = balanceAfter(rate, m.loan_term_years, loan, holdYears * 12);
  const netSale = salePrice - sellingCosts - loanBal;
  flows[flows.length - 1] += netSale;

  const npvVal = npv(m.discount_rate_pct, flows);
  const irrVal = irr(flows);
  const pbOps = paybackYears(equity0, opFlows, null);   // operations alone
  const pbExit = paybackYears(equity0, opFlows, netSale); // with the sale
  const pb = pbExit;
  const totalProfit = opFlows.reduce((a, b) => a + b, 0) + netSale;
  const roi = totalProfit / equity0;
  const cfMonthlyY1 = opFlows[0] / 12;
  const dscr = debtServiceAnnual === 0 ? 0 : noiY1 / debtServiceAnnual;
  const fixed = tax.annual + insurance + hoa;
  const breakevenRent = (fixed + debtServiceAnnual) / (12 * (1 - m.vacancy_pct - m.management_pct - m.maintenance_pct));
  const rentCushion = breakevenRent > 0 ? rent / breakevenRent : 0;
  const grossYield = (rent * 12) / price;

  return {
    price, rent, rate, down, loan, debtServiceAnnual, closing, taxAnnual: tax.annual, taxRate: tax.rate,
    insurance, hoaAnnual: hoa, equity0, grossRentAnnual, vacancyLoss, mgmt, maint,
    allInBasis: price + cfg.deal.holding_cost + cfg.deal.remodel + cfg.deal.extra,
    noiY1, cfMonthlyY1, cashFlowAnnualY1: opFlows[0], dscr, breakevenRent, rentCushion, grossYield,
    npv: npvVal, irr: irrVal, paybackYears: pb, paybackOps: pbOps, paybackWithExit: pbExit,
    roi, totalProfit, salePrice, netSale, loanBal, flows, opFlows,
  };
}

function scoreScenario(r, weights, cfg) {
  const w = weights;
  const hurdle = (cfg && cfg.market ? cfg.market.discount_rate_pct * 100 : 10);
  const parts = {
    cash_flow: curve(MAPS.cash_flow, r.cfMonthlyY1),
    dscr: curve(MAPS.dscr, r.dscr),
    irr: curve(MAPS.irr, r.irr),
    payback: curve(MAPS.payback, r.paybackYears),
    roi: curve(MAPS.roi, r.roi * 100),
    rent_cushion: curve(MAPS.rent_cushion, r.rentCushion),
  };
  let total = 0, wsum = 0;
  const contrib = {};
  for (const k of Object.keys(parts)) {
    const wt = w[k] != null ? w[k] : 0;
    total += parts[k] * wt;
    wsum += wt;
    contrib[k] = parts[k] * wt;
  }
  let score = wsum > 0 ? total / wsum : 0;

  // Return decides a deal: a strong cash-flow composite cannot outvote a
  // levered IRR that misses the hurdle. The correction is a pure multiplier so
  // the score stays monotonic in both IRR and price.
  const irrV = r.irr;
  const npvV = r.npv;
  const raw = score;
  let penalty = 1;
  let capReason = null;
  if (irrV == null) {
    penalty *= 0.5;
    capReason = 'IRR is not measurable on these inputs';
  } else {
    const shortfall = Math.max(0, hurdle - irrV);
    penalty *= 1 - Math.min(0.45, shortfall * 0.06);
    if (shortfall > 0.2) capReason = `IRR ${irrV.toFixed(1)}% is ${shortfall.toFixed(1)} pt under the ${hurdle}% hurdle (-${Math.round((1 - (1 - Math.min(0.45, shortfall * 0.06))) * 100)}% on the score)`;
  }
  if (npvV != null && npvV < 0) {
    penalty *= 0.92;
    capReason = (capReason ? capReason + ' · ' : '') + 'NPV is negative at the hurdle rate';
  }
  if (r.paybackOps == null) penalty *= 0.95;
  score = raw * penalty;
  score = Math.max(0, Math.min(10, score));

  const binding = Object.keys(contrib).sort((a, b) => (contrib[a] / (w[a] || 1)) - (contrib[b] / (w[b] || 1)))[0];
  return { score, rawScore: Math.max(0, Math.min(10, total / (wsum || 1))), parts, binding, capReason };
}

function verdictFor(score, minScore, r, cfg) {
  const hurdle = cfg ? cfg.market.discount_rate_pct * 100 : 10;
  const irrV = r ? r.irr : null;
  const npvV = r ? r.npv : null;
  if (irrV == null || irrV < 0 || (npvV != null && npvV < 0)) return 'PASS';
  if (score >= 7.5 && irrV >= hurdle) return 'INVEST';
  if (score >= 6.2 && irrV >= hurdle - 3) return 'CONDITIONAL';
  if (score >= 5) return 'MARGINAL';
  return 'PASS';
}

function money(n, dp = 0) {
  return (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
}

function reasonFor(r, s, cfg) {
  const bits = [];
  const cf = r.cfMonthlyY1;
  bits.push(cf >= 0 ? `+${money(cf)}/mo after debt` : `${money(cf)}/mo after debt`);
  bits.push(`DSCR ${r.dscr.toFixed(2)}`);
  bits.push(r.irr == null ? 'IRR n/a' : `IRR ${r.irr.toFixed(1)}%`);
  bits.push(r.paybackOps != null ? `payback ${r.paybackOps.toFixed(1)}yr from operations` : `no operational payback inside ${r.opFlows.length}yr (equity returns at sale, yr ${r.opFlows.length})`);
  bits.push(`ROI ${(r.roi * 100).toFixed(0)}%`);
  bits.push(`rent vs breakeven ${money(r.breakevenRent)} (x${r.rentCushion.toFixed(2)})`);
  const labels = {
    cash_flow: 'monthly cash flow',
    dscr: 'debt coverage',
    irr: 'return (IRR)',
    payback: 'payback time',
    roi: 'equity multiple / ROI',
    rent_cushion: 'rent margin over breakeven',
  };
  return {
    evidence: bits.join(' · ') + (s.capReason ? ' · score adjustment: ' + s.capReason : ''),
    binding: labels[s.binding] || s.binding,
    bindingScore: s.parts[s.binding],
  };
}

// Full 5x5 grid, ranked; returns top N and the whole matrix.
function runGrid(deal, cfg, opts = {}) {
  const prices = opts.prices || cfg.scenarios.prices;
  const rents = opts.rents || cfg.scenarios.rents;
  const rows = [];
  for (const price of prices) {
    for (const rent of rents) {
      const r = evaluate(deal, cfg, price, rent);
      const s = scoreScenario(r, cfg.score_weights, cfg);
      const reason = reasonFor(r, s, cfg);
      rows.push({ ...r, ...s, ...reason, verdict: verdictFor(s.score, cfg.filters.min_score, r, cfg) });
    }
  }
  const ranked = [...rows].sort((a, b) => b.score - a.score || (b.irr ?? -99) - (a.irr ?? -99));
  return { rows, ranked, top: ranked.slice(0, opts.topN || 5), prices, rents };
}

// Rent needed at a given price for the composite to reach the target score.
function rentForScore(deal, cfg, price, target, lo = 2500, hi = 12000) {
  const hits = (r0) => {
    const row = evaluate(deal, cfg, price, r0);
    const sc = scoreScenario(row, cfg.score_weights, cfg);
    return verdictFor(sc.score, cfg.filters.min_score, row, cfg) === 'PASS' ? sc.score : sc.score;
  };
  let a = lo, b = hi;
  if (hits(b) < target) return null;
  if (hits(a) >= target) return a;
  for (let i = 0; i < 60; i++) {
    const m = (a + b) / 2;
    if (hits(m) >= target) b = m; else a = m;
  }
  return Math.round(b / 25) * 25;
}

// Price needed at a given rent for the composite to reach the target score.
function priceForScore(deal, cfg, rent, target, lo = 250000, hi = 900000) {
  const scoreAt = (p) => {
    const row = evaluate(deal, cfg, p, rent);
    return scoreScenario(row, cfg.score_weights, cfg).score;
  };
  if (scoreAt(lo) < target) return null;
  if (scoreAt(hi) >= target) return hi;
  let a = lo, b = hi;
  for (let i = 0; i < 60; i++) {
    const m = (a + b) / 2;
    if (scoreAt(m) >= target) a = m; else b = m;
  }
  return Math.round(a / 5000) * 5000;
}

module.exports = { evaluate, runGrid, scoreScenario, verdictFor, curve, money, taxesFor, rentForScore, priceForScore };
