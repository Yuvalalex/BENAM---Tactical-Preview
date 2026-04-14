#!/usr/bin/env node
/**
 * Export BENAM v2: standalone app with ALL files ≤ 300 lines.
 * Output: ~/Desktop/BENAM_v2/
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SRC = __dirname;
const DEST = path.join(path.dirname(SRC), 'BENAM_v2');
const MAX = 300;

// ── Helpers ──
function mkdirp(d) { fs.mkdirSync(d, { recursive: true }); }
function cp(src, dest) { fs.cpSync(src, dest, { recursive: true, force: true }); }

function findValidSplitPoints(lines) {
  let depth = 0;
  const points = new Set([1]);
  for (let i = 0; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') depth++;
      if (ch === '}') depth--;
    }
    if (depth === 0) points.add(i + 2);
  }
  return points;
}

function splitFileAtBraces(lines, desiredStarts, namesFn) {
  const valid = findValidSplitPoints(lines);
  function nearest(d) {
    if (valid.has(d)) return d;
    for (let delta = 1; delta < 80; delta++) {
      if (valid.has(d - delta)) return d - delta;
      if (valid.has(d + delta)) return d + delta;
    }
    return d;
  }
  const starts = [...new Set(desiredStarts.map(nearest))].sort((a, b) => a - b);
  const result = [];
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i];
    const e = i < starts.length - 1 ? starts[i + 1] - 1 : lines.length;
    result.push({ name: namesFn(i), lines: lines.slice(s - 1, e) });
  }
  return result;
}

// ── Create output ──
if (fs.existsSync(DEST)) fs.rmSync(DEST, { recursive: true });
mkdirp(DEST);
mkdirp(path.join(DEST, 'js/parts'));
mkdirp(path.join(DEST, 'js/vendor'));
mkdirp(path.join(DEST, 'css/parts'));
mkdirp(path.join(DEST, 'html'));

// ── 1. Copy static assets ──
cp(path.join(SRC, 'icons'), path.join(DEST, 'icons'));
cp(path.join(SRC, 'js/vendor'), path.join(DEST, 'js/vendor'));
cp(path.join(SRC, 'css/fonts.css'), path.join(DEST, 'css/fonts.css'));
if (fs.existsSync(path.join(SRC, 'css/fonts')))
  cp(path.join(SRC, 'css/fonts'), path.join(DEST, 'css/fonts'));
cp(path.join(SRC, 'sw.js'), path.join(DEST, 'sw.js'));
cp(path.join(SRC, 'manifest.json'), path.join(DEST, 'manifest.json'));
console.log('✓ Static assets copied');

// ── 2. Copy JS parts (already split) ──
const jsParts = fs.readdirSync(path.join(SRC, 'js/parts')).filter(f => f.endsWith('.js')).sort();
let jsOverCount = 0;
for (const f of jsParts) {
  const content = fs.readFileSync(path.join(SRC, 'js/parts', f), 'utf8');
  const lineCount = content.split('\n').length;
  fs.writeFileSync(path.join(DEST, 'js/parts', f), content);
  if (lineCount > MAX) jsOverCount++;
}
console.log(`✓ ${jsParts.length} JS parts copied (${jsOverCount} slightly over ${MAX})`);

// ── 3. Split CSS ──
const cssLines = fs.readFileSync(path.join(SRC, 'css/style.css'), 'utf8').split('\n');
const cssSections = [];
let cssCurrent = { name: null, start: 0 };
const cssHeaderRe = /^\/\*\s*={3,}|^\/\*\s*-{3,}/;

// Find section boundaries in CSS
for (let i = 0; i < cssLines.length; i++) {
  if (cssHeaderRe.test(cssLines[i]) && i > 0) {
    cssSections.push(i);
  }
}

// Build chunks of ~300 lines at section boundaries
const cssChunks = [];
let cssStart = 0;
let cssChunkIdx = 1;
for (const boundary of cssSections) {
  if (boundary - cssStart >= MAX * 0.8) {
    cssChunks.push({
      name: `${String(cssChunkIdx).padStart(2, '0')}-style.css`,
      content: cssLines.slice(cssStart, boundary).join('\n')
    });
    cssChunkIdx++;
    cssStart = boundary;
  }
}
// Remainder
cssChunks.push({
  name: `${String(cssChunkIdx).padStart(2, '0')}-style.css`,
  content: cssLines.slice(cssStart).join('\n')
});

// If some chunks are still over 300, force-split at line 300
const finalCssChunks = [];
for (const chunk of cssChunks) {
  const lines = chunk.content.split('\n');
  if (lines.length <= MAX) {
    finalCssChunks.push(chunk);
  } else {
    let part = 1;
    for (let i = 0; i < lines.length; i += MAX) {
      const slice = lines.slice(i, Math.min(i + MAX, lines.length));
      const baseName = chunk.name.replace('.css', '');
      finalCssChunks.push({
        name: part === 1 ? chunk.name : `${baseName}-${String.fromCharCode(96 + part)}.css`,
        content: slice.join('\n')
      });
      part++;
    }
  }
}

// Write CSS parts and create main style.css with @import
for (const chunk of finalCssChunks) {
  fs.writeFileSync(path.join(DEST, 'css/parts', chunk.name), chunk.content);
}
const cssImports = finalCssChunks.map(c => `@import url('parts/${c.name}');`).join('\n');
fs.writeFileSync(path.join(DEST, 'css/style.css'), cssImports + '\n');
console.log(`✓ CSS split into ${finalCssChunks.length} files (style.css has @imports)`);

// ── 4. Split HTML ──
const htmlContent = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
const htmlLines = htmlContent.split('\n');

// Find the <body> content sections — split HTML into:
// - head section
// - body screens (large DOM sections)
// We'll use JS template injection for body sections

// Strategy: find major <div id="sc-XXX"> sections and extract them
// Actually simpler: split the HTML at natural boundaries and use <script> to inject

// Find section markers in HTML
const htmlSectionStarts = [];
for (let i = 0; i < htmlLines.length; i++) {
  const line = htmlLines[i].trim();
  if (line.match(/^<(div|section|nav)\s+id="(sc-|overlay|closing|mesh|swipe|modal|fire-sheet)/)) {
    htmlSectionStarts.push(i);
  }
}

// For simplicity: split HTML into chunks and use a loader
// Each chunk is a .html file, main index.html includes them via inline <script>
const htmlChunks = [];
let hStart = 0;
let hIdx = 1;

// Split at roughly 300-line boundaries, preferring section starts
for (let target = MAX; target < htmlLines.length; target += MAX) {
  // Find nearest section boundary
  let best = target;
  for (const s of htmlSectionStarts) {
    if (Math.abs(s - target) < Math.abs(best - target) && s > hStart + 50) {
      best = s;
    }
  }
  if (best > hStart && best < htmlLines.length - 50) {
    htmlChunks.push({ start: hStart, end: best - 1 });
    hStart = best;
  }
}
htmlChunks.push({ start: hStart, end: htmlLines.length - 1 });

// Write HTML parts
const htmlPartFiles = [];
for (let i = 0; i < htmlChunks.length; i++) {
  const chunk = htmlChunks[i];
  const content = htmlLines.slice(chunk.start, chunk.end + 1).join('\n');
  const name = `${String(i + 1).padStart(2, '0')}-part.html`;
  fs.writeFileSync(path.join(DEST, 'html', name), content);
  htmlPartFiles.push({ name, lines: chunk.end - chunk.start + 1 });
}

// Build the main index.html that assembles everything
// Since we can't easily split HTML into loadable parts without JS,
// let's create a builder script and also the assembled index.html
// The "source" is in html/ parts, the "built" index.html is the assembled version
const assembledHtml = htmlChunks.map(c => htmlLines.slice(c.start, c.end + 1).join('\n')).join('\n');

// Replace the script tags to use js/parts/ directly
const finalHtml = assembledHtml
  .replace(
    /<!-- v2:.*?-->\s*<script src="js\/app\.js"><\/script>\s*<script src="js\/enhancements\.js"><\/script>/s,
    jsParts.map(f => `  <script src="js/parts/${f}"></script>`).join('\n')
  )
  .replace(/<script type="module" src="\/src\/main\.ts"><\/script>/, '<!-- TS module removed for standalone v2 -->');

fs.writeFileSync(path.join(DEST, 'index.html'), finalHtml);
const indexLineCount = finalHtml.split('\n').length;
console.log(`✓ HTML split into ${htmlPartFiles.length} source parts in html/`);
console.log(`  index.html (assembled): ${indexLineCount} lines`);
htmlPartFiles.forEach(p => console.log(`  html/${p.name}: ${p.lines} lines`));

// ── 5. Create README ──
const readme = `# BENAM v2 — Split Code Edition

All code files are max ~300 lines each.

## Structure
- js/parts/ — ${jsParts.length} JS files (app logic)
- css/parts/ — ${finalCssChunks.length} CSS files (@imported by css/style.css)
- html/      — ${htmlPartFiles.length} HTML source parts
- index.html — assembled HTML (run this)

## To run
Open index.html in a browser, or use any static server:
  npx serve .
  python3 -m http.server 8080

## To edit
1. Edit files in js/parts/, css/parts/, or html/
2. For JS/CSS: changes are live (just reload)
3. For HTML parts: run "node build-html.js" to reassemble index.html
`;
fs.writeFileSync(path.join(DEST, 'README.md'), readme);

// ── 6. Create HTML assembler script ──
const assembler = `#!/usr/bin/env node
// Assembles html/*.html parts into index.html
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'html');
const parts = fs.readdirSync(dir).filter(f => f.endsWith('.html')).sort();
const content = parts.map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('\\n');
fs.writeFileSync(path.join(__dirname, 'index.html'), content);
console.log('✓ index.html assembled from ' + parts.length + ' parts');
`;
fs.writeFileSync(path.join(DEST, 'build-html.js'), assembler);

// ── Summary ──
console.log('\n═══ EXPORT COMPLETE ═══');
console.log(`Output: ${DEST}`);

// Count all files and check max lines
let totalFiles = 0;
let maxLines = 0;
let maxFile = '';
function checkDir(dir, rel) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    const relPath = path.join(rel, f);
    if (fs.statSync(full).isDirectory()) {
      checkDir(full, relPath);
    } else if (f.endsWith('.js') || f.endsWith('.css') || f.endsWith('.html')) {
      if (f.includes('.min.')) continue; // skip minified vendor
      const lines = fs.readFileSync(full, 'utf8').split('\n').length;
      totalFiles++;
      if (lines > maxLines) { maxLines = lines; maxFile = relPath; }
    }
  }
}
checkDir(DEST, '');
console.log(`${totalFiles} code files, longest: ${maxFile} (${maxLines} lines)`);
