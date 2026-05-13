#!/usr/bin/env node
/* eslint-disable no-console */

/*
 * Pull the 9 Welcome-screen emoji stickers from Figma as PNG @3x.
 *
 * Usage:
 *   FIGMA_TOKEN=figd_xxx FIGMA_FILE_KEY=xxx node scripts/figma-pull-emoji.js [--force]
 *   FIGMA_TOKEN=figd_xxx node scripts/figma-pull-emoji.js <fileKey> [--force]
 *
 * Env vars (token):    FIGMA_TOKEN (preferred) or FIGMA_ACCESS_TOKEN
 * Env vars (file key): FIGMA_FILE_KEY (preferred) or FIGMA_FILE, else argv[2]
 *
 * Behaviour:
 *   1. Walk the file tree, find the FRAME whose name matches ^2_.*[Ww]elcome.
 *   2. Log all image-fill descendants (name, type, id, bounding box).
 *   3. Map by semantic name where possible; fall back to top-left→bottom-right
 *      position ordering for any unmapped slugs. Tag fallbacks in the log.
 *   4. If > 18 candidates surface (way more than 9), STOP — refine filter.
 *   5. Otherwise download to assets/emoji/<slug>.png at scale=3. Idempotent;
 *      pass --force to re-download.
 */

const fs = require('fs');
const path = require('path');

const TOKEN = process.env.FIGMA_TOKEN || process.env.FIGMA_ACCESS_TOKEN;
const rawArgs = process.argv.slice(2);
const FORCE = rawArgs.includes('--force');
const positional = rawArgs.filter((a) => !a.startsWith('--'));
const FILE_KEY = process.env.FIGMA_FILE_KEY || process.env.FIGMA_FILE || positional[0];

if (!TOKEN) {
  console.error('error: set FIGMA_TOKEN (or FIGMA_ACCESS_TOKEN) in env');
  process.exit(1);
}
if (!FILE_KEY) {
  console.error(
    'error: set FIGMA_FILE_KEY (or FIGMA_FILE) in env, or pass fileKey as the first positional arg'
  );
  process.exit(1);
}

const SCALE = 3;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'emoji');
const API = 'https://api.figma.com/v1';
const HEADERS = { 'X-Figma-Token': TOKEN };
const FRAME_NAME_REGEX = /^2_.*[Ww]elcome/;
const MAX_REASONABLE_CANDIDATES = 18;

// Order matches DESIGN.md §4.1 listing. Used as the canonical mapping target
// and as the position-fallback ordering (top-left → bottom-right).
const TARGETS = [
  { slug: 'ac-unit', match: /\b(ac|air[\s-]?cond|snowflake|cold)\b/i },
  { slug: 'truck', match: /\b(truck|lorry|delivery)/i },
  { slug: 'hammer', match: /\bhammer/i },
  { slug: 'house', match: /\b(house|home(?!page))\b/i },
  { slug: 'hard-hat', match: /\b(hard[\s-]?hat|helmet|safety)/i },
  { slug: 'selfie', match: /\b(selfie|woman|girl|person|portrait)/i },
  { slug: 'barriers', match: /\b(barrier|cone|construction)/i },
  { slug: 'wrench', match: /\b(wrench|spanner|tool)/i },
  { slug: 'building', match: /\b(building|tower|office)/i },
];

async function figma(url, attempt = 1) {
  const res = await fetch(url, { headers: HEADERS });
  if (res.status === 429 && attempt <= 5) {
    const retryAfter = Number(res.headers.get('retry-after'));
    const wait = retryAfter > 0 ? retryAfter : Math.min(60, 1 * 2 ** (attempt - 1));
    console.warn(`  429 — waiting ${wait}s (attempt ${attempt}/5)`);
    await new Promise((r) => setTimeout(r, wait * 1000));
    return figma(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${url}`);
  return res.json();
}

function findFrame(node, regex, trail = []) {
  if (!node) return null;
  if (node.type === 'FRAME' && regex.test(node.name)) {
    return { node, trail: [...trail, node.name] };
  }
  for (const c of node.children || []) {
    const found = findFrame(c, regex, [...trail, node.name]);
    if (found) return found;
  }
  return null;
}

function hasImageFill(node) {
  if (!node.fills || !Array.isArray(node.fills)) return false;
  return node.fills.some((f) => f.type === 'IMAGE' && f.visible !== false);
}

function collectImageFillDescendants(node, depth = 0, acc = []) {
  if (!node || depth > 5) return acc;
  if (depth > 0 && hasImageFill(node)) acc.push(node);
  for (const c of node.children || []) collectImageFillDescendants(c, depth + 1, acc);
  return acc;
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length);
}
function padLeft(s, n) {
  s = String(s);
  return s.length >= n ? s.slice(0, n) : ' '.repeat(n - s.length) + s;
}

function mapBySemanticName(candidates) {
  const mapped = {};
  const used = new Set();
  for (const target of TARGETS) {
    for (const cand of candidates) {
      if (used.has(cand.id)) continue;
      if (target.match.test(cand.name)) {
        mapped[target.slug] = { node: cand, semantic: true };
        used.add(cand.id);
        break;
      }
    }
  }
  return mapped;
}

function mapByPositionFallback(candidates, alreadyMapped) {
  const used = new Set(Object.values(alreadyMapped).map((m) => m.node.id));
  const remaining = candidates
    .filter((c) => !used.has(c.id))
    .slice()
    .sort((a, b) => {
      const ay = a.absoluteBoundingBox?.y ?? 0;
      const by = b.absoluteBoundingBox?.y ?? 0;
      if (Math.abs(ay - by) > 60) return ay - by;
      const ax = a.absoluteBoundingBox?.x ?? 0;
      const bx = b.absoluteBoundingBox?.x ?? 0;
      return ax - bx;
    });
  const unfilled = TARGETS.filter((t) => !alreadyMapped[t.slug]);
  const out = { ...alreadyMapped };
  for (let i = 0; i < unfilled.length && i < remaining.length; i++) {
    out[unfilled[i].slug] = { node: remaining[i], semantic: false };
  }
  return out;
}

async function main() {
  console.log(`fetching file tree ${FILE_KEY}...`);
  const file = await figma(`${API}/files/${FILE_KEY}`);

  const found = findFrame(file.document, FRAME_NAME_REGEX);
  if (!found) {
    console.error(`\nerror: no FRAME matched ${FRAME_NAME_REGEX}`);
    console.error('search top-level page/frame names manually to refine.');
    process.exit(2);
  }

  const bb = found.node.absoluteBoundingBox || {};
  console.log(`\nmatched welcome frame:`);
  console.log(`  name: ${found.node.name}`);
  console.log(`  id:   ${found.node.id}`);
  console.log(`  path: ${found.trail.join(' › ')}`);
  console.log(`  size: ${Math.round(bb.width || 0)} × ${Math.round(bb.height || 0)}`);

  const candidates = collectImageFillDescendants(found.node);

  console.log(`\nimage-fill descendants inside frame (${candidates.length}):`);
  console.log(
    `  ${pad('#', 3)} ${pad('name', 36)} ${pad('type', 11)} ${pad('id', 16)} ${padLeft('x', 6)} ${padLeft('y', 6)} ${padLeft('w', 5)} ${padLeft('h', 5)}`
  );
  candidates.forEach((c, i) => {
    const cb = c.absoluteBoundingBox || {};
    console.log(
      `  ${pad(i + 1, 3)} ${pad(c.name, 36)} ${pad(c.type, 11)} ${pad(c.id, 16)} ${padLeft(Math.round(cb.x || 0), 6)} ${padLeft(Math.round(cb.y || 0), 6)} ${padLeft(Math.round(cb.width || 0), 5)} ${padLeft(Math.round(cb.height || 0), 5)}`
    );
  });

  if (candidates.length === 0) {
    console.error('\nerror: no image-fill nodes inside the Welcome frame.');
    console.error('the stickers may be vector groups rather than raster fills — extend the filter.');
    process.exit(3);
  }

  if (candidates.length > MAX_REASONABLE_CANDIDATES) {
    console.error(
      `\nerror: ${candidates.length} image-fill nodes found (> ${MAX_REASONABLE_CANDIDATES}). too ambiguous to pick 9.`
    );
    console.error('refine the filter (e.g. restrict to a named group/parent) and rerun.');
    process.exit(4);
  }

  const semanticMap = mapBySemanticName(candidates);
  const fullMap = mapByPositionFallback(candidates, semanticMap);

  console.log('\nmapping (semantic-name first, then position fallback):');
  for (const t of TARGETS) {
    const m = fullMap[t.slug];
    if (!m) {
      console.log(`  ${pad(t.slug, 10)} → (no match)`);
    } else {
      const tag = m.semantic ? '' : '   [POSITION-FALLBACK]';
      console.log(`  ${pad(t.slug, 10)} → "${m.node.name}"  (${m.node.id})${tag}`);
    }
  }

  const missing = TARGETS.filter((t) => !fullMap[t.slug]);
  if (missing.length > 0) {
    console.error(`\nerror: ${missing.length} target(s) unmapped: ${missing.map((t) => t.slug).join(', ')}`);
    process.exit(5);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const tasks = TARGETS.map((t, i) => {
    const out = path.join(OUT_DIR, `${t.slug}.png`);
    const exists = !FORCE && fs.existsSync(out) && fs.statSync(out).size > 0;
    return { target: t, index: i + 1, out, exists, nodeId: fullMap[t.slug].node.id };
  });

  const toDownload = tasks.filter((t) => !t.exists);
  for (const t of tasks.filter((t) => t.exists)) {
    console.log(`[${t.index}/${TARGETS.length}] ${t.target.slug}.png ⏭ skipped (exists)`);
  }

  if (toDownload.length === 0) {
    console.log('\nall files already exist. pass --force to re-download.');
    return;
  }

  const ids = toDownload.map((t) => t.nodeId).join(',');
  console.log(`\nrequesting ${toDownload.length} PNG render(s) at ${SCALE}x...`);
  const imgRes = await figma(
    `${API}/images/${FILE_KEY}?ids=${encodeURIComponent(ids)}&format=png&scale=${SCALE}`
  );
  const urls = imgRes.images || {};

  let failures = 0;
  for (const t of toDownload) {
    const url = urls[t.nodeId];
    if (!url) {
      console.error(`[${t.index}/${TARGETS.length}] ${t.target.slug}.png ✗ no url for ${t.nodeId}`);
      failures++;
      continue;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(t.out, buf);
      console.log(
        `[${t.index}/${TARGETS.length}] ${t.target.slug}.png ✓ (${(buf.length / 1024).toFixed(0)}KB)`
      );
    } catch (e) {
      console.error(`[${t.index}/${TARGETS.length}] ${t.target.slug}.png ✗ ${e.message}`);
      failures++;
    }
  }

  const downloaded = toDownload.length - failures;
  const skipped = tasks.length - toDownload.length;
  console.log(`\nsummary: ${downloaded} downloaded · ${skipped} skipped · ${failures} failed`);
  if (failures > 0) process.exit(6);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
