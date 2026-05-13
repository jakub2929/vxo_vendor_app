#!/usr/bin/env node
/* eslint-disable no-console */

// Bundles an SVG file into a TS module exporting its XML as a string constant,
// so it can be rendered by react-native-svg's <SvgXml/> without configuring a
// Metro SVG transformer.
//
// Usage:
//   node scripts/build-illustration.js <svgPath> <outTsPath> <exportName>
//
// Example:
//   node scripts/build-illustration.js \
//     assets/illustrations/lets-you-in.svg \
//     src/assets/lets-you-in-illustration.ts \
//     letsYouInIllustrationXml

const fs = require('fs');
const path = require('path');

const [, , svgPath, outPath, exportName] = process.argv;
if (!svgPath || !outPath || !exportName) {
  console.error('usage: node scripts/build-illustration.js <svgPath> <outTsPath> <exportName>');
  process.exit(1);
}

const svg = fs.readFileSync(svgPath, 'utf8').trim();
const escaped = svg
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${');

const ts = `// Auto-generated from ${svgPath}.
// Regenerate by running: node scripts/build-illustration.js ${svgPath} ${outPath} ${exportName}
// Inlined so react-native-svg's SvgXml can render it without a Metro SVG transformer.
export const ${exportName} = \`${escaped}\`;
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, ts);
console.log(`wrote ${outPath} (${ts.length} bytes)`);
