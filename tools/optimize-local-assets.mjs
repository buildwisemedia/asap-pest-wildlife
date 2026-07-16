#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { rmSync, renameSync } from 'node:fs';
import { extname } from 'node:path';

const assets = [
  ['assets/images/animals/andmore.png', 'assets/images/animals/andmore-optimized.webp', 800, 50],
  ['assets/images/animals/ant.webp', 'assets/images/animals/ant-optimized.webp', 600, 50],
  ['assets/images/animals/armadillo.png', 'assets/images/animals/armadillo-optimized.webp', 400, 46],
  ['assets/images/animals/beaver-navy.png', 'assets/images/animals/beaver-navy-optimized.webp', 800, 50],
  ['assets/images/animals/bee.png', 'assets/images/animals/bee-optimized.webp', 600, 50],
  ['assets/images/animals/groundhog.png', 'assets/images/animals/groundhog-optimized.webp', 200, 35],
  ['assets/images/animals/raccoon.png', 'assets/images/animals/raccoon-optimized.webp', 240, 35],
  ['assets/images/animals/rat-navy.png', 'assets/images/animals/rat-navy-optimized.webp', 800, 50],
  ['assets/images/animals/squirrel.webp', 'assets/images/animals/squirrel-optimized.webp', 600, 50],
  ['assets/images/mascots/orange-bird.svg', 'assets/images/vendor/61d8ec3884b9494dba6f6b3a-orange-bird-11ae6441dae362b9.webp', 400, 38],
  ['assets/images/backgrounds/about-bg.svg', 'assets/images/backgrounds/about-bg.webp', 700, 32],
  ['assets/images/backgrounds/about-hero-bg.svg', 'assets/images/backgrounds/about-hero-bg.webp', 700, 35],
  ['assets/images/backgrounds/careers-bg.svg', 'assets/images/backgrounds/careers-bg.webp', 1200, 48],
  ['assets/images/animals/bat.svg', 'assets/images/vendor/620abd6e3b4782815e163d2b-bat-29b19452eab87898.webp', 400, 42],
  ['assets/images/backgrounds/home-hero-bg.svg', 'assets/images/backgrounds/home-hero-bg.webp', 700, 25],
  ['assets/images/backgrounds/home-hero-bg.svg', 'assets/images/backgrounds/home-hero-bg-mobile.webp', 320, 22],
  ['assets/images/backgrounds/home-mission-bg.svg', 'assets/images/backgrounds/home-mission-bg.webp', 450, 18],
  ['https://cdn.prod.website-files.com/61a68c3ac2bbdc9f4c356d55/61ae96a074c2004c5736237f_contact-bg.svg', 'assets/images/vendor/61ae96a074c2004c5736237f-contact-bg-6343d65ed89d0ef7.webp', 900, 32],
  ['https://cdn.prod.website-files.com/61a68c3ac2bbdc9f4c356d55/61aea4b28f0ef66ccfaff8b9_services-bg.svg', 'assets/images/vendor/61aea4b28f0ef66ccfaff8b9-services-bg-af4fdcd712e414a7.webp', 900, 35],
];

for (const [sourcePath, outputPath, width, quality] of assets) {
  const temporaryPath = `${outputPath}.tmp.webp`;
  let downloadedSource = '';
  let localSource = sourcePath;
  if (/^https:\/\//.test(sourcePath)) {
    const sourceExtension = extname(new URL(sourcePath).pathname) || '.img';
    downloadedSource = `${outputPath}.download${sourceExtension}`;
    execFileSync('curl', [
      '-L',
      '--fail',
      '--silent',
      '--show-error',
      sourcePath,
      '--output',
      downloadedSource,
    ]);
    localSource = downloadedSource;
  }
  let rasterPath = localSource;
  let temporaryRaster = '';
  if (extname(localSource).toLowerCase() === '.svg') {
    temporaryRaster = `${outputPath}.source.png`;
    execFileSync('rsvg-convert', [
      '--keep-aspect-ratio',
      '--width', String(width),
      '--output', temporaryRaster,
      localSource,
    ]);
    rasterPath = temporaryRaster;
  }
  execFileSync('cwebp', [
    '-quiet',
    '-mt',
    '-q', String(quality),
    '-alpha_q', '80',
    '-resize', String(width), '0',
    rasterPath,
    '-o', temporaryPath,
  ]);
  renameSync(temporaryPath, outputPath);
  if (temporaryRaster) rmSync(temporaryRaster, { force: true });
  if (downloadedSource) rmSync(downloadedSource, { force: true });
  console.log(`Optimized ${outputPath}`);
}
