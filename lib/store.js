'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PROPS = path.join(ROOT, 'data', 'properties');
const STATE = path.join(ROOT, 'data', 'state.json');
const OUT = path.join(ROOT, 'out');
const CFG = path.join(ROOT, 'data', 'config.json');

function ensure() {
  for (const d of [PROPS, OUT]) fs.mkdirSync(d, { recursive: true });
}

function slugify(s) {
  return String(s || 'property')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 70);
}

function keyOf(p) {
  return p.zpid ? 'zpid-' + p.zpid : p.mls_id ? 'mls-' + p.mls_id : slugify(p.address);
}

function save(p) {
  ensure();
  const k = keyOf(p);
  const f = path.join(PROPS, k + '.json');
  fs.writeFileSync(f, JSON.stringify(p, null, 2));
  return { key: k, file: f };
}

function load(id) {
  ensure();
  if (!id) return null;
  const direct = path.join(PROPS, String(id).replace(/\.json$/, '') + '.json');
  if (fs.existsSync(direct)) return JSON.parse(fs.readFileSync(direct, 'utf8'));
  const files = fs.readdirSync(PROPS).filter((f) => f.endsWith('.json'));
  for (const f of files) {
    const p = JSON.parse(fs.readFileSync(path.join(PROPS, f), 'utf8'));
    if (p.zpid === String(id) || p.mls_id === String(id) || slugify(p.address) === slugify(id)) return p;
    if (p.address && String(id).toLowerCase().includes(String(p.address).toLowerCase().slice(0, 18))) return p;
  }
  return null;
}

function all() {
  ensure();
  return fs.readdirSync(PROPS).filter((f) => f.endsWith('.json')).map((f) => {
    try { return JSON.parse(fs.readFileSync(path.join(PROPS, f), 'utf8')); } catch { return null; }
  }).filter(Boolean);
}

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return { seen: [], last_scan: null, runs: {} }; }
}

function writeState(s) {
  ensure();
  fs.writeFileSync(STATE, JSON.stringify(s, null, 2));
}

function readConfig() {
  return JSON.parse(fs.readFileSync(CFG, 'utf8'));
}

function writeConfig(c) {
  fs.writeFileSync(CFG, JSON.stringify(c, null, 2));
}

module.exports = { ROOT, PROPS, OUT, CFG, ensure, slugify, keyOf, save, load, all, readState, writeState, readConfig, writeConfig };
