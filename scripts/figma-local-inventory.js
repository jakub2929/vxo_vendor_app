#!/usr/bin/env node
/* eslint-disable no-console */

/*
 * Build a local-only inventory of what's been downloaded from Figma so far.
 * No API calls — just reads files in assets/figma-refs/.
 *
 * Usage:
 *   node scripts/figma-local-inventory.js
 *
 * Output:
 *   assets/figma-refs/inventory.json
 *     { screens: [...png filenames], icons: [...svg filenames], tokens: { hasTokens, colors, typography, shadows } }
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'assets', 'figma-refs');

function listFiles(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(ext))
    .sort();
}

const screens = listFiles(ROOT, '.png');
const icons = listFiles(path.join(ROOT, 'icons'), '.svg');

let tokensSummary = { hasTokens: false };
const tokensPath = path.join(ROOT, 'tokens', 'tokens.json');
if (fs.existsSync(tokensPath)) {
  const t = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
  tokensSummary = {
    hasTokens: true,
    colors: (t.colors || []).length,
    typography: (t.typography || []).length,
    shadows: (t.shadows || []).length,
  };
}

const inventory = { screens, icons, tokens: tokensSummary };
const outPath = path.join(ROOT, 'inventory.json');
fs.writeFileSync(outPath, JSON.stringify(inventory, null, 2));

console.log(`screens: ${screens.length}`);
console.log(`icons:   ${icons.length}`);
console.log(`tokens:  ${tokensSummary.hasTokens ? `${tokensSummary.colors} colors / ${tokensSummary.typography} text / ${tokensSummary.shadows} shadows` : '— missing'}`);
console.log(`wrote ${path.relative(process.cwd(), outPath)}`);
