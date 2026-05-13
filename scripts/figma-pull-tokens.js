#!/usr/bin/env node
/* eslint-disable no-console */

/*
 * Walk a Figma file and extract design tokens: unique colors, text styles, shadows.
 *
 * Usage:
 *   FIGMA_TOKEN=figd_xxx node scripts/figma-pull-tokens.js <fileKey>
 *
 * Writes:
 *   assets/figma-refs/tokens/tokens.json    — raw structured data
 *   assets/figma-refs/tokens/tokens.ts      — typed theme object you can import
 */

const fs = require('fs');
const path = require('path');

const TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = process.argv[2];

if (!TOKEN || !FILE_KEY) {
  console.error('usage: FIGMA_TOKEN=figd_xxx node scripts/figma-pull-tokens.js <fileKey>');
  process.exit(1);
}

const OUT_DIR = path.join(__dirname, '..', 'assets', 'figma-refs', 'tokens');
const API = 'https://api.figma.com/v1';
const HEADERS = { 'X-Figma-Token': TOKEN };

async function figma(url, attempt = 1) {
  const res = await fetch(url, { headers: HEADERS });
  if (res.status === 429 && attempt <= 5) {
    const wait = Math.min(60, 5 * 2 ** (attempt - 1));
    console.warn(`  429 — retrying in ${wait}s (attempt ${attempt}/5)`);
    await new Promise((r) => setTimeout(r, wait * 1000));
    return figma(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${url}`);
  return res.json();
}

function rgbaToHex({ r, g, b, a = 1 }) {
  const ch = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
  const hex = `#${ch(r)}${ch(g)}${ch(b)}`;
  return a < 1 ? `${hex}${ch(a)}` : hex;
}

function fmtColor(color, opacity) {
  const a = opacity != null ? opacity : (color.a != null ? color.a : 1);
  return rgbaToHex({ r: color.r, g: color.g, b: color.b, a });
}

function walk(node, ctx) {
  if (!node) return;

  if (Array.isArray(node.fills)) {
    for (const f of node.fills) {
      if (f.type === 'SOLID' && f.color && f.visible !== false) {
        ctx.colors.add(fmtColor(f.color, f.opacity));
      }
    }
  }
  if (Array.isArray(node.strokes)) {
    for (const s of node.strokes) {
      if (s.type === 'SOLID' && s.color && s.visible !== false) {
        ctx.colors.add(fmtColor(s.color, s.opacity));
      }
    }
  }
  if (Array.isArray(node.effects)) {
    for (const e of node.effects) {
      if ((e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW') && e.visible !== false) {
        ctx.shadows.add(
          JSON.stringify({
            type: e.type,
            color: fmtColor(e.color, e.color && e.color.a),
            x: e.offset && e.offset.x,
            y: e.offset && e.offset.y,
            blur: e.radius,
            spread: e.spread || 0,
          })
        );
      }
    }
  }
  if (node.type === 'TEXT' && node.style) {
    const s = node.style;
    ctx.texts.add(
      JSON.stringify({
        fontFamily: s.fontFamily,
        fontWeight: s.fontWeight,
        fontSize: s.fontSize,
        lineHeight: s.lineHeightPx,
        letterSpacing: s.letterSpacing,
        textCase: s.textCase,
      })
    );
  }

  for (const c of node.children || []) walk(c, ctx);
}

function tsFile(tokens) {
  return `/* Auto-generated from Figma. Do not edit by hand — run \`npm run figma:tokens\` to refresh. */

export const colors = ${JSON.stringify(tokens.colors, null, 2)} as const;

export const typography = ${JSON.stringify(tokens.typography, null, 2)} as const;

export const shadows = ${JSON.stringify(tokens.shadows, null, 2)} as const;
`;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`fetching ${FILE_KEY} (full tree)...`);
  const file = await figma(`${API}/files/${FILE_KEY}`);

  const ctx = { colors: new Set(), texts: new Set(), shadows: new Set() };
  for (const page of file.document.children || []) walk(page, ctx);

  const colors = [...ctx.colors].sort();
  const typography = [...ctx.texts]
    .map((s) => JSON.parse(s))
    .sort((a, b) => (b.fontSize || 0) - (a.fontSize || 0))
    .filter((t, i, arr) => arr.findIndex((x) => JSON.stringify(x) === JSON.stringify(t)) === i);
  const shadows = [...ctx.shadows].map((s) => JSON.parse(s));

  const tokens = { colors, typography, shadows };

  const jsonPath = path.join(OUT_DIR, 'tokens.json');
  const tsPath = path.join(OUT_DIR, 'tokens.ts');
  fs.writeFileSync(jsonPath, JSON.stringify(tokens, null, 2));
  fs.writeFileSync(tsPath, tsFile(tokens));

  console.log(`  ${colors.length} colors`);
  console.log(`  ${typography.length} text styles`);
  console.log(`  ${shadows.length} shadows`);
  console.log(`wrote ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`wrote ${path.relative(process.cwd(), tsPath)}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
