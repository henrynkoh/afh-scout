'use strict';
// NWMLS public search (nwmls.com, Broker Public Portal feed). Server-rendered
// Next.js flight payload -> JSON listings. No login, no API key.
const { getText } = require('./net');

function inflightPayload(html) {
  const parts = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)]
    .map((m) => JSON.parse('"' + m[1] + '"'));
  return parts.join('');
}

function parseListingPage(html) {
  const all = inflightPayload(html);
  const totalMatch = all.match(/"initialTotalCount":(\d+)/);
  const total = totalMatch ? Number(totalMatch[1]) : null;
  const idx = all.indexOf('"initialProperties":[');
  if (idx < 0) return { listings: [], total: total || 0 };
  const start = all.indexOf('[', idx + 20);
  const raw = sliceBalancedLocal(all, start);
  const listings = raw ? JSON.parse(raw) : [];
  return { listings, total: total == null ? listings.length : total };
}

function sliceBalancedLocal(s, startIdx) {
  let depth = 0, inStr = false, esc = false;
  for (let p = startIdx; p < s.length; p++) {
    const c = s[p];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) return s.slice(startIdx, p + 1); }
  }
  return null;
}

function normalise(l, area) {
  const price = l?.Listing?.Price?.ListPrice ?? null;
  const addr = l?.DisplayName || [l?.DisplayFirstLine, l?.DisplayLastLine].filter(Boolean).join(', ');
  const cityZip = (l?.DisplayLastLine || '').split(',').map((s) => s.trim());
  const hoa = l?.Computed?.HoaMonthlyFee ?? l?.Computed?.HoaAnnualFee != null ? (l?.Computed?.HoaMonthlyFee ?? null) : null;
  return {
    source: 'NWMLS',
    source_area: area,
    mls_id: l?.Listing?.ListingId || null,
    address: addr,
    street: l?.DisplayFirstLine || null,
    city: cityZip[0] || null,
    state: 'WA',
    zip: (cityZip[1] || '').replace(/\D/g, '') || null,
    price,
    status: l?.Listing?.StandardStatus || l?.Listing?.MlsStatus || null,
    beds: l?.Structure?.BedroomsTotal ?? l?.Computed?.BedroomsTotalInteger ?? null,
    baths: l?.Structure?.BathroomsTotalInteger ?? l?.Computed?.BathroomsTotalInteger ?? null,
    sqft: l?.Structure?.LivingArea ?? l?.Computed?.LivingAreaSquareFeet ?? null,
    lot_acres: l?.Computed?.LotSizeAcres ?? null,
    on_market: l?.Computed?.OnMarketDate || null,
    price_change: l?.Computed?.PriceChangeAmount ?? null,
    hoa_monthly: hoa,
    type: l?.PropertySubType || l?.PropertyType || null,
    garage_yn: l?.StructureDerived?.GarageYN ?? l?.StructureDerived?.AttachedGarageYN ?? null,
    lat: l?.LocationPoint?.lat ?? null,
    lon: l?.LocationPoint?.lon ?? null,
    hero: l?.ImagesHero || (Array.isArray(l?.Images) ? l.Images[0] : null) || null,
    nwmls_url: `https://www.nwmls.com/homes-for-sale/${area}`,
  };
}

async function fetchArea(area) {
  const url = `https://www.nwmls.com/homes-for-sale/${area}`;
  const { text } = await getText(url);
  const { listings, total } = parseListingPage(text);
  return { area, url, total, listings: listings.map((l) => normalise(l, area)) };
}

async function sweep(areas, opts = {}) {
  const out = [];
  const errors = [];
  for (const area of areas) {
    try {
      const r = await fetchArea(area);
      out.push(...r.listings);
      if (opts.onArea) opts.onArea(r);
    } catch (e) {
      errors.push({ area, error: e.message });
    }
  }
  const seen = new Set();
  const unique = out.filter((x) => {
    const k = x.mls_id || x.address;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { listings: unique, errors };
}

module.exports = { fetchArea, sweep, parseListingPage };
