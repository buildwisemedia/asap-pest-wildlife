#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';

const outputDirectory = '.purgecss-output';
const generatedPath = `${outputDirectory}/webflow.vendor.css`;
const safelistPath = '.purgecss-safelist.html';
const minifiedPath = '.webflow.shared.min.css';

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });

const css = readFileSync('assets/css/webflow.vendor.css', 'utf8');
const generatedClasses = new Set();
for (const match of css.matchAll(/\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/g)) {
  const className = match[1];
  if (/^(?:w-|w--|wf-|fs-|is-)/.test(className)) generatedClasses.add(className);
}
['active', 'disabled', 'open'].forEach((className) => generatedClasses.add(className));
writeFileSync(safelistPath, `<div class="${[...generatedClasses].join(' ')}"></div>\n`);

execFileSync('npx', [
  '--yes',
  'purgecss@7.0.2',
  '--css',
  'assets/css/webflow.vendor.css',
  '--content',
  '*.html',
  '**/*.html',
  'assets/js/*.js',
  safelistPath,
  '--output',
  outputDirectory,
], { stdio: 'inherit' });

renameSync(generatedPath, 'assets/css/webflow.shared.css');
execFileSync('npx', [
  '--yes',
  'csso-cli@4.0.2',
  'assets/css/webflow.shared.css',
  '--output',
  minifiedPath,
], { stdio: 'inherit' });
renameSync(minifiedPath, 'assets/css/webflow.shared.css');
writeFileSync(
  'assets/css/webflow.shared.css',
  readFileSync('assets/css/webflow.shared.css', 'utf8')
    .replace(/\.w-input::placeholder,\.w-select::placeholder\{color:#999\}/g, '')
);
rmSync(outputDirectory, { recursive: true, force: true });
rmSync(safelistPath, { force: true });
console.log('Built assets/css/webflow.shared.css');
