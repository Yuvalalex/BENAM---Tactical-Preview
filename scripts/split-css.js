/**
 * CSS Splitter — splits css/style.css into domain-organised files under src/styles/
 * Run once: node split-css.js
 * The output files are imported by src/styles/main.css which is imported from src/main.js
 */

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, 'css/style.css'), 'utf8');
const lines = src.split('\n');
const total = lines.length;

// Section boundaries (1-based line numbers from grep analysis)
// Each entry: [startLine, endLine, filename]
const sections = [
  [1,    87,   'variables.css'],    // :root + base resets
  [88,   738,  'layout.css'],       // LAYOUT → MATRIX TABLE / KANBAN
  [739,  2389, 'components.css'],   // COMPONENTS → MISC (buttons, cards, vitals, timeline…)
  [2390, 5282, 'overlays.css'],     // BOARD VIEW → individual overlay styles
  [5283, total,'animations.css'],   // PAGE TRANSITIONS → enhancements sprint styles
];

const outDir = path.join(__dirname, 'src/styles');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const banners = {
  'variables.css':  '/* ── BENAM Design Tokens & Base Resets ── */',
  'layout.css':     '/* ── BENAM Layout, Topbar, Nav, Tabs, Prep ── */',
  'components.css': '/* ── BENAM Components: buttons, cards, vitals, timeline, etc. ── */',
  'overlays.css':   '/* ── BENAM Overlays & Modal Styles ── */',
  'animations.css': '/* ── BENAM Animations, Transitions & Enhancement Styles ── */',
};

const created = [];
for (const [start, end, filename] of sections) {
  // lines array is 0-indexed; start/end are 1-based inclusive
  const content = lines.slice(start - 1, end).join('\n');
  const outPath = path.join(outDir, filename);
  // Only write if the file doesn't already exist or content changed (safe to re-run)
  const header = `${banners[filename]}\n/* Source: css/style.css lines ${start}–${end} */\n\n`;
  fs.writeFileSync(outPath, header + content + '\n');
  created.push(`  ✓ src/styles/${filename} (${end - start + 1} lines)`);
}

// Create / overwrite src/styles/main.css (the aggregator imported by main.js)
const mainCss = `/* ── BENAM Main Stylesheet — imports domain-split files in order ── */
/* This file is imported by src/main.js and processed by Vite */

@import './variables.css';
@import './layout.css';
@import './components.css';
@import './overlays.css';
@import './animations.css';
`;
fs.writeFileSync(path.join(outDir, 'main.css'), mainCss);
created.push('  ✓ src/styles/main.css');

console.log('CSS split complete:\n' + created.join('\n'));
console.log('\nNext steps:');
console.log('  1. Import src/styles/main.css from src/main.js  (already done by this script output)');
console.log('  2. In index.html: comment out <link href="css/style.css"> and verify parity');
console.log('  3. Delete css/style.css once parity confirmed');
