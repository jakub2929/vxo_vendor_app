#!/usr/bin/env node
/* eslint-disable no-console */

/*
 * Export top-level FRAMEs from a Figma file as PNG references.
 *
 * Usage:
 *   FIGMA_TOKEN=figd_xxx node scripts/figma-pull-screens.js <fileKey> [nameRegex] [scale]
 *
 * Defaults:
 *   nameRegex = ^\d+_       (matches "1_Light_splash screen", "20_Completed Job Thread"...)
 *   scale     = 2           (retina)
 *
 * Examples:
 *   # all screens starting with a number
 *   FIGMA_TOKEN=$FIGMA_TOKEN node scripts/figma-pull-screens.js BOenpimP099TBsGHwgLmxD
 *
 *   # only sign-in / sign-up flow
 *   FIGMA_TOKEN=$FIGMA_TOKEN node scripts/figma-pull-screens.js BOenpimP099TBsGHwgLmxD '^[3-9]_'
 *
 *   # everything at 3x
 *   FIGMA_TOKEN=$FIGMA_TOKEN node scripts/figma-pull-screens.js BOenpimP099TBsGHwgLmxD '.*' 3
 */

const fs = require('fs');
const path = require('path');

const TOKEN = process.env.FIGMA_TOKEN;
const FILE_KEY = process.argv[2];
const NAME_REGEX = new RegExp(process.argv[3] || '^\\d+_');
const SCALE = Number(process.argv[4] || 2);

if (!TOKEN || !FILE_KEY) {
  console.error('usage: FIGMA_TOKEN=figd_xxx node scripts/figma-pull-screens.js <fileKey> [nameRegex] [scale]');
  process.exit(1);
}

const OUT_DIR = path.join(__dirname, '..', 'assets', 'figma-refs');
const API = 'https://api.figma.com/v1';
const HEADERS = { 'X-Figma-Token': TOKEN };
const BATCH = 30;

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
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`fetching tree ${FILE_KEY}...`);
  const file = await figma(`${API}/files/${FILE_KEY}?depth=2`);

  const screens = [];
  for (const page of file.document.children || []) {
    for (const node of page.children || []) {
      if (node.type === 'FRAME' && NAME_REGEX.test(node.name)) {
        screens.push({ id: node.id, name: node.name });
      }
    }
  }

  if (screens.length === 0) {
    console.error(`no FRAME matched ${NAME_REGEX}`);
    process.exit(2);
  }
  console.log(`exporting ${screens.length} frames at ${SCALE}x → ${path.relative(process.cwd(), OUT_DIR)}/`);

  for (let i = 0; i < screens.length; i += BATCH) {
    const chunk = screens.slice(i, i + BATCH);
    const ids = chunk.map((s) => s.id).join(',');
    const imgRes = await figma(
      `${API}/images/${FILE_KEY}?ids=${encodeURIComponent(ids)}&format=png&scale=${SCALE}`
    );
    const urls = imgRes.images || {};

    for (const s of chunk) {
      const url = urls[s.id];
      if (!url) {
        console.warn(`  skip ${s.name} (no url)`);
        continue;
      }
      const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
      const file = path.join(OUT_DIR, `${slug(s.name)}.png`);
      fs.writeFileSync(file, buf);
      console.log(`  ${path.relative(process.cwd(), file)}  (${(buf.length / 1024).toFixed(0)} KB)`);
    }
  }
  console.log('done.');
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
