'use strict';
// Core real-estate finance math. Zero dependencies.

function pmt(annualRatePct, years, principal) {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

function balanceAfter(annualRatePct, years, principal, monthsPaid) {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  const p = pmt(annualRatePct, years, principal);
  if (r === 0) return Math.max(0, principal - p * monthsPaid);
  const bal = principal * Math.pow(1 + r, monthsPaid) - p * ((Math.pow(1 + r, monthsPaid) - 1) / r);
  return Math.max(0, bal);
}

function npv(ratePct, flows) {
  const r = ratePct / 100;
  return flows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + r, t), 0);
}

// IRR via bisection on [-0.95, 3.00]; returns null when no sign change.
function irr(flows) {
  const f = (r) => flows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + r, t), 0);
  let lo = -0.95, hi = 3.0;
  let flo = f(lo), fhi = f(hi);
  if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return null;
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    const fm = f(mid);
    if (Math.abs(fm) < 1e-7) return mid * 100;
    if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return ((lo + hi) / 2) * 100;
}

// Years until cumulative operating cash flow covers the initial equity.
// Falls back to the exit year when operations alone never repay it.
function paybackYears(equityAtRisk, operatingFlows, exitFlow) {
  let cum = 0;
  for (let y = 0; y < operatingFlows.length; y++) {
    const prev = cum;
    cum += operatingFlows[y];
    if (cum >= equityAtRisk) {
      const need = equityAtRisk - prev;
      const frac = operatingFlows[y] === 0 ? 0 : need / operatingFlows[y];
      return y + frac;
    }
  }
  if (exitFlow != null) {
    const withExit = cum + exitFlow;
    if (withExit >= equityAtRisk) {
      const need = equityAtRisk - cum;
      const frac = exitFlow === 0 ? 0 : need / exitFlow;
      return operatingFlows.length + frac;
    }
  }
  return null;
}

module.exports = { pmt, balanceAfter, npv, irr, paybackYears };
