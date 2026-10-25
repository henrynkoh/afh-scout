'use strict';
// Stage 1: the filter. Decides whether a listing is even worth a feasibility run.

function check(name, state, value, rule) {
  return { name, state, value, rule }; // state: pass | fail | unknown
}

function screenProperty(p, cfg) {
  const f = cfg.filters;
  const checks = [];

  checks.push(check('Listing price inside scenario band', (p.price >= f.min_price && p.price <= f.max_price) ? 'pass' : 'fail',
    p.price, `$${f.min_price.toLocaleString()} - $${f.max_price.toLocaleString()}`));

  const st = String(p.status || '').toUpperCase();
  checks.push(check('Actively for sale', /FOR_SALE|ACTIVE|COMING/.test(st) ? 'pass' : 'fail', p.status || 'unknown', 'Active / coming soon'));

  checks.push(check('Single-family residence', /SINGLE_FAMILY|SINGLE FAMILY/.test(String(p.home_type || '').toUpperCase() + ' ' + String(p.type || '').toUpperCase()) ? 'pass' : 'unknown',
    p.home_type || p.type || 'unknown', 'Detached house (AFH occupancy)'));

  checks.push(check('Bedrooms for the existing home', (p.beds == null) ? 'unknown' : (p.beds >= f.min_beds ? 'pass' : 'fail'),
    p.beds, `>= ${f.min_beds} bd in main home`));

  const garageSf = p.garage_sf || p.garage_sf_est;
  let garage;
  if (p.garage_yn === false) garage = 'fail';
  else if (garageSf != null) garage = garageSf >= f.min_garage_sf ? 'pass' : 'fail';
  else garage = p.garage_yn === true ? 'unknown' : 'unknown';
  checks.push(check('Garage to convert', garage, garageSf ? `~${garageSf} sf${p.garage_dims ? ' (' + p.garage_dims + ')' : ''}` : (p.parking ? p.parking.join(', ') : 'unknown'),
    `Measured >= ${f.min_garage_sf} sf garage (2 bedrooms needs ~500-689 sf, 3 needs ~690-736 sf)`));

  if (garageSf != null) {
    const bedsInGarage = garageSf >= 690 ? 3 : garageSf >= 500 ? 2 : garageSf >= 400 ? 2 : 0;
    checks.push(check('Licensed bedrooms from garage', bedsInGarage >= 2 ? 'pass' : 'fail', `${bedsInGarage} bd (${garageSf} sf)`, '2-3 bedrooms per garage size'));
  }

  const hoa = p.hoa_monthly || 0;
  checks.push(check('HOA carry', hoa * 12 <= 1200 ? 'pass' : 'unknown', hoa ? `$${hoa}/mo` : 'none', '<= $1,200/yr'));

  const sewer = String(p.sewer || '').toLowerCase();
  checks.push(check('Public sewer', /public/.test(sewer) ? 'pass' : (/septic/.test(sewer) ? 'unknown' : 'unknown'),
    p.sewer || 'not stated', 'Public sewer preferred; septic needs health jurisdiction capacity sign-off'));

  const county = p.county || '';
  checks.push(check('County tax rate known', cfg.market.property_tax.by_county[county] != null ? 'pass' : 'unknown',
    county || 'unknown', 'Thurston / Lewis levy table'));

  const fails = checks.filter((c) => c.state === 'fail');
  const unknowns = checks.filter((c) => c.state === 'unknown');
  return {
    pass: fails.length === 0,
    checks,
    fails: fails.map((c) => c.name),
    unknowns: unknowns.map((c) => c.name),
    garage_sf: garageSf,
    garage_beds: garageSf != null ? (garageSf >= 690 ? 3 : garageSf >= 500 ? 2 : garageSf >= 400 ? 2 : 0) : null,
  };
}

module.exports = { screenProperty };
