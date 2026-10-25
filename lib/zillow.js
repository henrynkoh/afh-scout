'use strict';
// Zillow public listing pages. The entry point the user asked for is a Zillow
// property link; this module turns that link into structured facts.
const { getText } = require('./net');

function nextData(html) {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

function propertyFromNext(j) {
  const cc = j?.props?.pageProps?.componentProps?.gdpClientCache;
  if (!cc) return null;
  let parsed;
  try { parsed = JSON.parse(cc); } catch { return null; }
  for (const key of Object.keys(parsed)) {
    const p = parsed[key]?.property;
    if (p && p.zpid) return p;
  }
  return null;
}

const ZIP_COUNTY = {
  '98531': 'Lewis', '98532': 'Lewis', '98579': 'Thurston',
  '98501': 'Thurston', '98502': 'Thurston', '98503': 'Thurston', '98506': 'Thurston',
  '98512': 'Thurston', '98513': 'Thurston', '98516': 'Thurston',
};

// Garage/shop dimensions written in the listing copy: 24' x 30', 24x30, 22 ft x 24 ft.
function garageFromText(text) {
  if (!text) return null;
  const t = String(text);
  const re = /(\d{2})\s*(?:'|’|ft|feet)?\s*(?:x|×|by)\s*(\d{2})\s*(?:'|’|ft|feet)?/gi;
  let best = null;
  let m;
  while ((m = re.exec(t))) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a < 16 || b < 16 || a > 60 || b > 60) continue;
    const sf = a * b;
    const window = t.slice(Math.max(0, m.index - 120), m.index + 120).toLowerCase();
    if (/garage|shop|carport|shop\/garage|barn/.test(window) && sf >= 300) {
      if (!best || sf > best.sf) best = { sf, dims: a + "'x" + b + "'" };
    }
  }
  return best;
}

function num(v) {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/[^0-9.-]/g, ''));
  return isFinite(n) ? n : null;
}

function normalise(p, url) {
  const rf = p.resoFacts || {};
  const parking = rf.parkingFeatures || rf.parking || null;
  const parkingArr = Array.isArray(parking) ? parking : (parking ? [parking] : []);
  const hasGarage = /garage/i.test(parkingArr.join(' ')) || (rf.garageSpaces != null && num(rf.garageSpaces) > 0);
  const garageText = garageFromText(p.description);
  const garageSfFromSpaces = rf.garageSpaces != null ? Math.round(num(rf.garageSpaces) * 240) : null;
  const garageSfEst = garageText ? garageText.sf : garageSfFromSpaces;
  let taxRate = p.propertyTaxRate != null ? num(p.propertyTaxRate) : null;
  if (taxRate != null && taxRate >= 0.1) taxRate = taxRate / 100; // Zillow sends 0.64 meaning 0.64%
  let taxAnnual = num(rf.taxAnnualAmount);
  if (taxAnnual == null && taxRate != null && p.price) taxAnnual = Math.round(p.price * taxRate);
  // Reject implausible tax figures instead of carrying a wrong number into the model.
  if (taxAnnual != null && p.price && (taxAnnual / p.price < 0.003 || taxAnnual / p.price > 0.03)) {
    taxAnnual = (taxRate != null && p.price) ? Math.round(p.price * taxRate) : null;
  }
  const address = (p.address && (p.address.streetAddress || p.address)) || p.streetAddress || null;
  return {
    source: 'Zillow',
    zpid: p.zpid ? String(p.zpid) : null,
    url: p.hdpUrl ? `https://www.zillow.com${p.hdpUrl}` : url,
    address: address ? `${address}${p.city ? ', ' + p.city : ''}${p.state ? ', ' + p.state : ''}${p.zipcode ? ' ' + p.zipcode : ''}` : null,
    street: address,
    city: p.city || null,
    state: p.state || null,
    zip: p.zipcode || null,
    county: p.county ? String(p.county).replace(/\s*County$/i, '') : (ZIP_COUNTY[p.zipcode] || null),
    price: num(p.price),
    status: p.homeStatus || null,
    beds: num(p.bedrooms),
    baths: num(p.bathrooms),
    sqft: num(p.livingArea),
    lot_acres: p.lotAreaUnits === 'sqft' ? num(p.lotAreaValue) / 43560 : num(p.lotAreaValue),
    year_built: num(p.yearBuilt),
    home_type: p.homeType || null,
    hoa_monthly: num(p.monthlyHoaFee) ?? num(rf.hoaFee),
    tax_annual: taxAnnual,
    tax_rate: taxRate,
    parking: parkingArr.length ? parkingArr : null,
    garage_yn: hasGarage,
    garage_spaces: num(rf.garageSpaces),
    garage_sf_est: garageSfEst,
    garage_dims: garageText ? garageText.dims : null,
    mls_id: rf.mlsId || rf.listingId || p.listingFeedID || null,
    subdivision: rf.subdivisionName || null,
    zoning: rf.zoningDescription || rf.zoning || null,
    sewer: rf.sewer || null,
    water: rf.waterSource || null,
    heating: rf.heating || null,
    cooling: rf.cooling || null,
    description: (p.description || '').slice(0, 1200) || null,
    days_on_market: p.daysOnZillow != null ? num(p.daysOnZillow) : null,
    zestimate: num(p.zestimate),
    rent_zestimate: num(p.rentZestimate),
    fetched_at: new Date().toISOString(),
  };
}

function looksLikeAddress(s) {
  return /\d/.test(s) && /,/.test(s);
}

function addressToUrl(addr) {
  const slug = addr.replace(/[#]/g, '').trim().replace(/\s+/g, '-');
  return `https://www.zillow.com/homes/${encodeURIComponent(slug)}_rb/`;
}

async function fetchProperty(urlOrAddress) {
  const isUrl = /^https?:\/\//i.test(urlOrAddress);
  const url = isUrl ? urlOrAddress : addressToUrl(urlOrAddress);
  const { text, url: finalUrl } = await getText(url);
  const j = nextData(text);
  if (!j) throw new Error('Zillow page had no structured data (blocked or empty): ' + finalUrl);
  const p = propertyFromNext(j);
  if (!p) {
    // Address search page: fall back to the first search result.
    const sr = j?.props?.pageProps?.searchPageState?.cat1?.searchResults?.listResults
      || j?.props?.pageProps?.initialReduxState?.maps?.listings;
    const first = Array.isArray(sr) ? sr[0] : null;
    if (first?.detailUrl) {
      if (!isUrl && !looksLikeAddress(urlOrAddress)) throw new Error('Not a property or address: ' + urlOrAddress);
      return fetchProperty(`https://www.zillow.com${first.detailUrl}`);
    }
    throw new Error('Could not find a property record at ' + finalUrl);
  }
  return normalise(p, finalUrl);
}

module.exports = { fetchProperty, addressToUrl, normalise, nextData, ZIP_COUNTY, garageFromText };
