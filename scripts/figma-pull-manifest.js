#!/usr/bin/env node
/* eslint-disable no-console */

/*
 * Build a manifest that links screens ↔ icons ↔ tokens.
 *
 * Usage:
 *   FIGMA_TOKEN=figd_xxx node scripts/figma-pull-manifest.js <fileKey> [screenRegex]
 *
 * Uses disk cache (assets/figma-refs/.cache/file-<key>.json) — re-fetches only
 * if cache is missing or older than CACHE_TTL_HOURS (default 24).
 */

const fs = require('fs');
const path = require('path');

const TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = process.argv[2];
const SCREEN_REGEX = new RegExp(process.argv[3] || '^\\d+_');
const ICON_REGEX = /^(icon\/|Iconly\/)/i;
const CACHE_TTL_HOURS = 24;

if (!FILE_KEY) {
  console.error('usage: FIGMA_TOKEN=figd_xxx node scripts/figma-pull-manifest.js <fileKey> [screenRegex]');
  process.exit(1);
}

const OUT_DIR = path.join(__dirname, '..', 'assets', 'figma-refs');
const CACHE_DIR = path.join(OUT_DIR, '.cache');
const CACHE_FILE = path.join(CACHE_DIR, `file-${FILE_KEY}.json`);

async function figmaFetch(url, attempt = 1) {
  if (!TOKEN) throw new Error('FIGMA_TOKEN not set in environment');
  const res = await fetch(url, { headers: { 'X-Figma-Token': TOKEN } });
  if (res.status === 429 && attempt <= 5) {
    const retryAfter = Number(res.headers.get('retry-after'));
    const wait = retryAfter > 0 ? retryAfter : Math.min(60, 5 * 2 ** (attempt - 1));
    console.warn(`  429 — server says wait ${wait}s (attempt ${attempt}/5)`);
    await new Promise((r) => setTimeout(r, wait * 1000));
    return figmaFetch(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${url}`);
  return res.json();
}

async function loadFileTree() {
  if (fs.existsSync(CACHE_FILE)) {
    const ageHours = (Date.now() - fs.statSync(CACHE_FILE).mtimeMs) / 3_600_000;
    if (ageHours < CACHE_TTL_HOURS) {
      console.log(`using cache (age ${ageHours.toFixed(1)}h) ${path.relative(process.cwd(), CACHE_FILE)}`);
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    }
    console.log(`cache is ${ageHours.toFixed(1)}h old (TTL ${CACHE_TTL_HOURS}h) — refetching`);
  } else {
    console.log('no cache — fetching from Figma API');
  }

  const file = await figmaFetch(`https://api.figma.com/v1/files/${FILE_KEY}`);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(file));
  console.log(`cached ${path.relative(process.cwd(), CACHE_FILE)}`);
  return file;
}

function slug(name) {
  return name
    .toLowerCase()
    .replace(/^icon\//i, '')
    .replace(/^iconly\//i, '')
    .replace(/^light\//i, '')
    .replace(/^bold\//i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
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

function walk(node, screen, allIconsByName) {
  if (!node) return;

  if ((node.type === 'INSTANCE' || node.type === 'COMPONENT') && ICON_REGEX.test(node.name)) {
    const key = slug(node.name);
    if (!screen.icons.find((i) => i.file === `${key}.svg`)) {
      screen.icons.push({ name: node.name, file: `${key}.svg` });
    }
    allIconsByName.set(node.name, (allIconsByName.get(node.name) || new Set()).add(screen._key));
  } else if (node.type === 'INSTANCE' && !ICON_REGEX.test(node.name)) {
    if (!screen.components.find((c) => c.name === node.name)) {
      screen.components.push({ name: node.name, id: node.id });
    }
  }

  for (const f of node.fills || []) {
    if (f.type === 'SOLID' && f.color && f.visible !== false) {
      screen._colorSet.add(fmtColor(f.color, f.opacity));
    }
  }
  for (const s of node.strokes || []) {
    if (s.type === 'SOLID' && s.color && s.visible !== false) {
      screen._colorSet.add(fmtColor(s.color, s.opacity));
    }
  }

  if (node.type === 'TEXT' && node.characters && node.style) {
    screen.texts.push({
      text: node.characters.slice(0, 80),
      fontFamily: node.style.fontFamily,
      fontWeight: node.style.fontWeight,
      fontSize: node.style.fontSize,
    });
  }

  for (const c of node.children || []) walk(c, screen, allIconsByName);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const file = await loadFileTree();

  const screens = {};
  const allIconsByName = new Map();

  for (const page of file.document.children || []) {
    for (const node of page.children || []) {
      if (node.type !== 'FRAME' || !SCREEN_REGEX.test(node.name)) continue;
      const key = slug(node.name);
      const screen = {
        id: node.id,
        name: node.name,
        png: `${key}.png`,
        icons: [],
        components: [],
        colors: [],
        texts: [],
        _colorSet: new Set(),
        _key: key,
      };
      walk(node, screen, allIconsByName);
      screen.colors = [...screen._colorSet].sort();
      delete screen._colorSet;
      delete screen._key;
      screens[key] = screen;
    }
  }

  const iconUsage = {};
  for (const [name, screensSet] of allIconsByName) {
    iconUsage[name] = [...screensSet].sort();
  }

  const manifest = { screens, iconUsage };
  const outPath = path.join(OUT_DIR, 'manifest.json');
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2));

  const totals = {
    screens: Object.keys(screens).length,
    icons: Object.keys(iconUsage).length,
    refs: Object.values(screens).reduce((n, s) => n + s.icons.length + s.components.length, 0),
  };
  console.log(`  ${totals.screens} screens, ${totals.icons} unique icons, ${totals.refs} usage refs`);
  console.log(`wrote ${path.relative(process.cwd(), outPath)}`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
