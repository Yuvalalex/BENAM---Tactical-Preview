#!/usr/bin/env node
/**
 * Concatenates js/parts/*.js files back into js/app.js + js/enhancements.js
 * Source files: js/parts/01-*.js through 40-*.js
 * Output: js/app.js (parts 01-33) + js/enhancements.js (parts 34-40)
 */
const fs = require('fs');
const path = require('path');

const partsDir = path.join(__dirname, 'js/parts');
const files = fs.readdirSync(partsDir).filter(f => f.endsWith('.js')).sort();

const appParts = files.filter(f => parseInt(f) <= 33);
const enhParts = files.filter(f => parseInt(f) >= 34);

function concat(parts, outFile) {
  const content = parts.map(f => {
    return fs.readFileSync(path.join(partsDir, f), 'utf8');
  }).join('\n');
  fs.writeFileSync(path.join(__dirname, outFile), content, 'utf8');
  const lineCount = content.split('\n').length;
  console.log(`${outFile}: ${parts.length} files → ${lineCount} lines`);
}

concat(appParts, 'js/app.js');
concat(enhParts, 'js/enhancements.js');
console.log('✓ Done');
