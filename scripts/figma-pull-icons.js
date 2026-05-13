#!/usr/bin/env node
/* eslint-disable no-console */

/*
 * Pull SVG icons from a Figma file into assets/figma-refs/icons/.
 *
 * Usage:
 *   FIGMA_TOKEN=figd_xxx node scripts/figma-pull-icons.js <fileKey> [nameRegex]
 *
 * Default nameRegex matches both real components AND instances of icon-library
 * components (e.g. "Iconly/Light/More Circle"). Pass a custom regex to narrow.
 *
 * Examples:
 *   # everything that looks like an icon
 *   FIGMA_TOKEN=$FIGMA_TOKEN node scripts/figma-pull-icons.js BOenpimP099TBsGHwgLmxD
 *
 *   # only Iconly Light set
 *   FIGMA_TOKEN=$FIGMA_TOKEN node scripts/figma-pull-icons.js BOenpimP099TBsGHwgLmxD '^Iconly/Light/'
 */

const fs = require('fs');
const path = require('path');

const TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = process.argv[2];
const NAME_REGEX = new RegExp(process.argv[3] || '^(icon\\/|Iconly\\/)', 'i');

if (!TOKEN || !FILE_KEY) {
  console.error('usage: FIGMA_TOKEN=figd_xxx node scripts/figma-pull-icons.js <fileKey> [nameRegex]');
  process.exit(1);
}

const OUT_DIR = path.join(__dirname, '..', 'assets', 'figma-refs', 'icons');
const API = 'https://api.figma.com/v1';
const HEADERS = { 'X-Figma-Token': TOKEN };
const BATCH = 50;

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

function slug(name) {
  return name
    .toLowerCase()
    .replace(/^icon\//i, '')
    .replace(/^iconly\//i, '')
    .replace(/^light\//i, '')
    .replace(/^bold\//i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function collect(node, acc) {
  if (!node) return;
  if ((node.type === 'COMPONENT' || node.type === 'INSTANCE') && NAME_REGEX.test(node.name)) {
    const key = slug(node.name);
    if (!acc.has(key)) acc.set(key, { id: node.id, name: node.name, key });
  }
  for (const c of node.children || []) collect(c, acc);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`fetching ${FILE_KEY}...`);
  const file = await figma(`${API}/files/${FILE_KEY}`);

  const map = new Map();
  for (const page of file.document.children || []) collect(page, map);

  const icons = [...map.values()];
  if (icons.length === 0) {
    console.error(`no nodes matched ${NAME_REGEX}`);
    process.exit(2);
  }
  console.log(`found ${icons.length} unique icons (after dedup by name)`);

  for (let i = 0; i < icons.length; i += BATCH) {
    const chunk = icons.slice(i, i + BATCH);
    const ids = chunk.map((s) => s.id).join(',');
    const imgRes = await figma(
      `${API}/images/${FILE_KEY}?ids=${encodeURIComponent(ids)}&format=svg`
    );
    const urls = imgRes.images || {};

    for (const icon of chunk) {
      const url = urls[icon.id];
      if (!url) {
        console.warn(`  skip ${icon.name} (no url)`);
        continue;
      }
      const svg = await (await fetch(url)).text();
      const file = path.join(OUT_DIR, `${icon.key}.svg`);
      fs.writeFileSync(file, svg);
      console.log(`  ${path.relative(process.cwd(), file)}`);
    }
  }
  console.log('done.');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
