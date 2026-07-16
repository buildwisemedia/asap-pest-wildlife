#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, extname } from 'node:path';
import { tmpdir } from 'node:os';

const root = process.cwd();
const vendorDirectory = `${root}/assets/images/vendor`;
const manifestPath = `${vendorDirectory}/manifest.json`;
const stylesheetPath = `${root}/assets/css/webflow.vendor.css`;
const performanceCss = readFileSync(`${root}/assets/css/performance.css`, 'utf8').trim();
const sharedCss = readFileSync(`${root}/assets/css/webflow.shared.css`, 'utf8').trim();
const transparentPixel = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
const socialImage = 'https://removeasap.com/assets/images/logos/logo-orange.png';
const metaPixelFallback =
  '<noscript data-bwm-meta-pixel><img height="1" width="1" style="display:none" alt="" aria-hidden="true" ' +
  'src="https://www.facebook.com/tr?id=26350078141329630&ev=PageView&noscript=1"/></noscript>';
const legalLinks =
  '<div data-bwm-legal-links class="background---navy small-text text-color---cream text-align---center" ' +
  'style="padding:12px"><a href="tel:7706913636" class="text-color---cream">Call (770) 691-3636</a> ' +
  '<span aria-hidden="true">·</span> <a href="/privacy-policy/" class="text-color---cream">Privacy Policy</a> ' +
  '<span aria-hidden="true">·</span> <a href="/terms-of-service/" class="text-color---cream">' +
  'Terms of Service</a></div>';
const regenerateMode = process.env.BWM_REGENERATE_VENDOR || '';
const forceRegenerate = Boolean(regenerateMode);
const dimensionCache = new Map();

mkdirSync(vendorDirectory, { recursive: true });

const htmlFiles = execFileSync('git', ['ls-files', '-z', '--', '*.html'], {
  encoding: 'utf8',
}).split('\0').filter(Boolean);

const existingManifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf8'))
  : {};
const manifest = { ...existingManifest };

const isVendorImage = (value) => {
  if (!/^https:\/\/cdn\.prod\.website-files\.com\//i.test(value)) return false;
  try {
    const pathname = new URL(value).pathname.toLowerCase();
    return /\.(avif|gif|jpe?g|png|svg|webp)$/.test(pathname);
  } catch {
    return false;
  }
};

function findRemoteImages(value) {
  const matches = value.match(/https:\/\/cdn\.prod\.website-files\.com\/[^\s"'<>]+/gi) || [];
  return matches
    .map((url) => url.replace(/&amp;/g, '&'))
    .filter(isVendorImage);
}

function imageWidth(path) {
  const result = spawnSync('sips', ['-g', 'pixelWidth', path], { encoding: 'utf8' });
  if (result.status !== 0) return 0;
  const match = result.stdout.match(/pixelWidth:\s*(\d+)/);
  return match ? Number(match[1]) : 0;
}

function imageDimensions(path) {
  if (dimensionCache.has(path)) return dimensionCache.get(path);
  const result = spawnSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', path], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    dimensionCache.set(path, null);
    return null;
  }
  const width = Number(result.stdout.match(/pixelWidth:\s*(\d+)/)?.[1] || 0);
  const height = Number(result.stdout.match(/pixelHeight:\s*(\d+)/)?.[1] || 0);
  const dimensions = width && height ? { width, height } : null;
  dimensionCache.set(path, dimensions);
  return dimensions;
}

function convertToWebp(input, output, extension, options = {}) {
  let rasterInput = input;
  let temporaryPng = '';

  if (extension === '.svg') {
    temporaryPng = `${input}.png`;
    execFileSync('rsvg-convert', ['--keep-aspect-ratio', '--output', temporaryPng, input]);
    rasterInput = temporaryPng;
  }

  const width = imageWidth(rasterInput);
  const quality = options.quality || 55;
  const maxWidth = options.maxWidth || 1200;
  const args = ['-quiet', '-mt', '-q', String(quality), '-alpha_q', '85'];
  if (width > maxWidth) args.push('-resize', String(maxWidth), '0');
  args.push(rasterInput, '-o', output);

  const converted = spawnSync('cwebp', args, { encoding: 'utf8' });
  if (temporaryPng) rmSync(temporaryPng, { force: true });

  if (converted.status === 0) return;
  if (extension === '.webp') {
    copyFileSync(input, output);
    return;
  }
  throw new Error(`Unable to convert ${input}: ${converted.stderr}`);
}

function localize(url) {
  const regenerateThisUrl = forceRegenerate && (
    regenerateMode === '1' ||
    regenerateMode === 'all' ||
    (regenerateMode === 'wildlife' && url.includes('/61a6f04dba9e11e400c344e8/'))
  );
  if (!regenerateThisUrl && manifest[url] && existsSync(`${root}${manifest[url]}`)) {
    return manifest[url];
  }

  const hash = createHash('sha256').update(url).digest('hex').slice(0, 16);
  const parsed = new URL(url);
  const extension = extname(parsed.pathname).toLowerCase() || '.img';
  const sourceName = basename(parsed.pathname, extension)
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'asset';
  const outputName = `${sourceName}-${hash}.webp`;
  const outputPath = `${vendorDirectory}/${outputName}`;
  const localPath = `/assets/images/vendor/${outputName}`;
  const temporaryPath = `${tmpdir()}/asap-${hash}${extension}`;

  console.log(`Localizing ${url}`);
  execFileSync('curl', ['-L', '--fail', '--silent', '--show-error', url, '--output', temporaryPath]);
  const isWildlifeCollection = parsed.pathname.includes('/61a6f04dba9e11e400c344e8/');
  convertToWebp(temporaryPath, outputPath, extension, {
    quality: isWildlifeCollection ? 35 : 55,
    maxWidth: isWildlifeCollection ? 700 : 1200,
  });
  rmSync(temporaryPath, { force: true });

  manifest[url] = localPath;
  return localPath;
}

const documents = new Map(
  htmlFiles.map((file) => [file, readFileSync(`${root}/${file}`, 'utf8')])
);
let stylesheet = readFileSync(stylesheetPath, 'utf8');
const urls = new Set(findRemoteImages(stylesheet));
if (forceRegenerate) {
  Object.keys(manifest)
    .filter((url) =>
      regenerateMode === '1' ||
      regenerateMode === 'all' ||
      (regenerateMode === 'wildlife' && url.includes('/61a6f04dba9e11e400c344e8/'))
    )
    .forEach((url) => urls.add(url));
}

for (const html of documents.values()) {
  html.replace(/<(?:img|source)\b[^>]*>/gi, (tag) => {
    findRemoteImages(tag).forEach((url) => urls.add(url));
    return tag;
  });
}

for (const url of [...urls].sort()) {
  const localPath = localize(url);
  stylesheet = stylesheet.split(url).join(localPath);
  stylesheet = stylesheet.split(url.replace(/&/g, '&amp;')).join(localPath);
  for (const [file, html] of documents) {
    documents.set(
      file,
      html
        .split(url).join(localPath)
        .split(url.replace(/&/g, '&amp;')).join(localPath)
    );
  }
}

writeFileSync(stylesheetPath, stylesheet);
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
const wildlifeHero = Object.entries(manifest).find(([url]) =>
  url.endsWith('/6626ade011192e31a242a67b_Image%20(19).png')
)?.[1];

let changedFiles = 0;
let deferredImages = 0;
let removedAnalyticsTags = 0;

for (const [file, beforeLocalization] of documents) {
  const original = readFileSync(`${root}/${file}`, 'utf8');
  let html = beforeLocalization;

  html = html.replace(
    /\sdata-wf-(?:ao-click-engagement-tracking|component-context|element-id|native-id-path)="[^"]*"/gi,
    ''
  );
  html = html.replace(
    /<link\b(?=[^>]*\brel="preconnect")(?=[^>]*\bhref="https:\/\/cdn\.prod\.website-files\.com")[^>]*\/?>/gi,
    ''
  );
  html = html.replace(
    /<link\b[^>]*href="https:\/\/cdn\.prod\.website-files\.com\/[^"]*favicon\.png"[^>]*\/?>/gi,
    '<link href="/assets/images/logos/favicon.png" rel="shortcut icon" type="image/x-icon"/>'
  );
  html = html.replace(
    /<link\b[^>]*href="https:\/\/cdn\.prod\.website-files\.com\/[^"]*webclip\.png"[^>]*\/?>/gi,
    '<link href="/assets/images/logos/webclip.png" rel="apple-touch-icon"/>'
  );

  html = html.replace(/<html\b([^>]*)>/i, (tag, attributes) => {
    if (/\blang=/i.test(attributes)) return tag;
    return `<html lang="en"${attributes}>`;
  });

  if (!/<meta\b[^>]*property="og:image"/i.test(html) && /<\/head>/i.test(html)) {
    html = html.replace(
      /<\/head>/i,
      `<meta property="og:image" content="${socialImage}"/>` +
      `<meta name="twitter:image" content="${socialImage}"/>\n</head>`
    );
  }

  if (!html.includes('data-bwm-meta-pixel') && /<body\b[^>]*>/i.test(html)) {
    html = html.replace(/<body\b[^>]*>/i, (tag) => `${tag}${metaPixelFallback}`);
  }

  if (!/(?:privacy-policy|terms-of-service)\/index\.html$/i.test(file)) {
    html = html.replace(/\shref="mailto:[^"]*"/gi, ' href="/contact/"');
  }

  html = html.replace(/<input\b[^>]*>/gi, (tag) => {
    const placeholder = tag.match(/\splaceholder="([^"]*)"/i)?.[1];
    if (placeholder === undefined) return tag;
    let next = tag.replace(/\splaceholder="[^"]*"/i, '');
    if (placeholder && !/\saria-label=/i.test(next)) {
      next = next.replace(/>$/, ` aria-label="${placeholder}">`);
    }
    return next;
  });
  html = html.replace(
    /\n\/\* Modern Browsers \(Chrome, Safari, Edge, Firefox\) \*\/[\s\S]*?\.text-field::-ms-input-placeholder\s*\{[^}]*\}\n/i,
    '\n'
  );

  if (html.includes('data-bwm-legal-links')) {
    html = html.replace(/<div data-bwm-legal-links\b[^>]*>[\s\S]*?<\/div>/i, legalLinks);
  }

  if (
    !html.includes('data-bwm-legal-links') &&
    !/href="\/terms-of-service\/?"/i.test(html) &&
    /<\/body>/i.test(html)
  ) {
    html = html.replace(/<\/body>/i, `${legalLinks}\n</body>`);
  }

  if (file === 'index.html') {
    html = html
      .replace(
        '<h1 class="responsive-h2">Giving<br/></h1>',
        '<p class="responsive-h2">Giving<br/></p>'
      )
      .replace(
        '<h1 class="hero-h3">One person at a time<br/></h1>',
        '<p class="hero-h3">One person at a time<br/></p>'
      );

    if (!html.includes('data-bwm-hero-cta')) {
      html = html.replace(
        '<div class="spacing-bottom---small"><p class="hero-h3">One person at a time<br/></p></div>',
        '<div class="spacing-bottom---small"><p class="hero-h3">One person at a time<br/></p></div>' +
        '<div data-bwm-hero-cta class="spacing-bottom---small">' +
        '<a href="/contact/" class="long-button w-button">Get Your Free Estimate</a></div>'
      );
    }
  }

  const inlinePerformanceCss = `<style data-bwm-performance>\n${performanceCss}\n</style>`;
  if (/<style data-bwm-performance>[\s\S]*?<\/style>/i.test(html)) {
    html = html.replace(
      /<style data-bwm-performance>[\s\S]*?<\/style>/i,
      inlinePerformanceCss
    );
  } else {
    html = html.replace(
      /<link href="\/assets\/css\/performance\.css" rel="stylesheet"\/?>/i,
      inlinePerformanceCss
    );
  }

  html = html.replace(
    /<link\b[^>]*href="https:\/\/cdn\.prod\.website-files\.com\/61a68c3ac2bbdc9f4c356d55\/css\/asap-wildlife-removal\.webflow\.shared\.[^"]+\.css"[^>]*\/?>/gi,
    '<link rel="preload" href="/assets/css/webflow.shared.css" as="style"/><link href="/assets/css/webflow.shared.css" rel="stylesheet"/>'
  );

  if (file === 'index.html') {
    const inlineSharedCss = `<style data-bwm-shared>\n${sharedCss}\n</style>`;
    if (/<style data-bwm-shared>[\s\S]*?<\/style>/i.test(html)) {
      html = html.replace(
        /<style data-bwm-shared>[\s\S]*?<\/style>(?:<link data-bwm-shared-full[^>]*>\s*<noscript data-bwm-shared-fallback>[\s\S]*?<\/noscript>)?/i,
        inlineSharedCss
      );
    } else {
      html = html.replace(
        /<link rel="preload" href="\/assets\/css\/webflow\.shared\.css" as="style"\/?>\s*<link href="\/assets\/css\/webflow\.shared\.css" rel="stylesheet"\/?>/i,
        inlineSharedCss
      );
    }
  }

  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (tag) => {
    if (/bwm-analytics\.js/i.test(tag)) return tag;
    if (
      /google_tags_first_party|developer_id|redditstatic|googletagmanager\.com\/(?:gtag|gtm)\.js|GTM-K953HZ9R/i.test(tag)
    ) {
      removedAnalyticsTags += 1;
      return '';
    }
    return tag;
  });

  html = html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (!/\bloading=(?:"lazy"|'lazy')/i.test(tag)) return tag;
    if (/\bdata-bwm-lazy-src=/i.test(tag)) return tag;

    const srcMatch = tag.match(/\ssrc=(?:"([^"]*)"|'([^']*)')/i);
    if (!srcMatch) return tag;
    const src = srcMatch[1] ?? srcMatch[2] ?? '';
    if (src.startsWith('data:')) return tag;

    deferredImages += 1;
    let next = tag.replace(
      /\ssrc=(?:"[^"]*"|'[^']*')/i,
      ` src="${transparentPixel}" data-bwm-lazy-src="${src}"`
    );
    next = next.replace(
      /\ssrcset=(?:"([^"]*)"|'([^']*)')/i,
      (_match, doubleQuoted, singleQuoted) =>
        ` data-bwm-lazy-srcset="${doubleQuoted ?? singleQuoted ?? ''}"`
    );
    next = next.replace(
      /\ssizes=(?:"([^"]*)"|'([^']*)')/i,
      (_match, doubleQuoted, singleQuoted) =>
        ` data-bwm-lazy-sizes="${doubleQuoted ?? singleQuoted ?? ''}"`
    );
    return next;
  });

  if (file === 'index.html') {
    html = html.replace(/<img\b[^>]*\bclass="[^"]*\bhome-bat-position\b[^"]*"[^>]*>/gi, (tag) => {
      const source = tag.match(/\sdata-bwm-lazy-src="([^"]+)"/i)?.[1];
      if (!source) return tag;
      return tag
        .replace(/\bloading=(?:"lazy"|'lazy')/i, 'loading="eager" fetchpriority="high"')
        .replace(
          new RegExp(`\\ssrc="${transparentPixel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`),
          ` src="${source}"`
        )
        .replace(/\sdata-bwm-lazy-src="[^"]+"/i, '');
    });
  }

  if (file === 'wildlife/index.html' && wildlifeHero) {
    html = html.replace(/<img\b[^>]*>/gi, (tag) => {
      if (!tag.includes(`data-bwm-lazy-src="${wildlifeHero}"`)) return tag;
      return tag
        .replace(/\bloading=(?:"lazy"|'lazy')/i, 'loading="eager" fetchpriority="high"')
        .replace(
          new RegExp(`\\ssrc="${transparentPixel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`),
          ` src="${wildlifeHero}"`
        )
        .replace(new RegExp(`\\sdata-bwm-lazy-src="${wildlifeHero.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`), '');
    });
  }

  html = html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (/\bwidth="\d+"/i.test(tag) && /\bheight="\d+"/i.test(tag)) return tag;
    const lazySource = tag.match(/\sdata-bwm-lazy-src="([^"]+)"/i)?.[1];
    const regularSource = tag.match(/\ssrc="([^"]+)"/i)?.[1];
    const source = lazySource || regularSource;
    if (!source?.startsWith('/')) return tag;
    const path = `${root}${decodeURIComponent(source.split('?')[0])}`;
    if (!existsSync(path)) return tag;
    const dimensions = imageDimensions(path);
    if (!dimensions) return tag;

    const existingWidth = Number(tag.match(/\bwidth="(\d+)"/i)?.[1] || 0);
    const existingHeight = Number(tag.match(/\bheight="(\d+)"/i)?.[1] || 0);
    const width = existingWidth || (
      existingHeight
        ? Math.round(dimensions.width * existingHeight / dimensions.height)
        : dimensions.width
    );
    const height = existingHeight || (
      existingWidth
        ? Math.round(dimensions.height * existingWidth / dimensions.width)
        : dimensions.height
    );
    const attributes = [
      existingWidth ? '' : ` width="${width}"`,
      existingHeight ? '' : ` height="${height}"`,
    ].join('');
    return tag.replace(/\/?>$/, (ending) => `${attributes}${ending}`);
  });

  html = html.replace(/<[^>]+\bclass="[^"]+"[^>]*>/gi, (tag) => {
    if (!/\b(?:home-mission-background|about-aim-background|careers-background|contact-section-2-background|services-bg)\b/i.test(tag)) {
      return tag;
    }
    if (/\bdata-bwm-lazy-background\b/i.test(tag)) return tag;
    return tag.replace(/>$/, ' data-bwm-lazy-background>');
  });

  html = html.replace(/<picture\b[^>]*>[\s\S]*?<\/picture>/gi, (picture) => {
    if (!/\bdata-bwm-lazy-src=/i.test(picture)) return picture;
    return picture.replace(/<source\b[^>]*>/gi, (tag) => {
      if (/\bdata-bwm-lazy-srcset=/i.test(tag)) return tag;
      return tag.replace(
        /\ssrcset=(?:"([^"]*)"|'([^']*)')/i,
        (_match, doubleQuoted, singleQuoted) =>
          ` data-bwm-lazy-srcset="${doubleQuoted ?? singleQuoted ?? ''}"`
      );
    });
  });

  if (!html.includes('/assets/js/lazy-images.js') && /<\/head>/i.test(html)) {
    html = html.replace(
      /<\/head>/i,
      '<script defer src="/assets/js/lazy-images.js"></script>\n</head>'
    );
  }

  if (file === 'index.html' && !html.includes('data-bwm-hero-preload') && /<\/head>/i.test(html)) {
    html = html.replace(
      /<\/head>/i,
      '<link data-bwm-hero-preload rel="preload" as="image" href="/assets/images/backgrounds/home-hero-bg-mobile.webp" media="(max-width: 767px)"/>' +
      '<link data-bwm-hero-preload rel="preload" as="image" href="/assets/images/backgrounds/home-hero-bg.webp" media="(min-width: 768px)"/>\n</head>'
    );
  }

  if (file === 'about/index.html' && !html.includes('data-bwm-about-preload') && /<\/head>/i.test(html)) {
    html = html.replace(
      /<\/head>/i,
      '<link data-bwm-about-preload rel="preload" as="image" href="/assets/images/backgrounds/about-hero-bg.webp"/>' +
      '<link data-bwm-about-preload rel="preload" as="image" href="/assets/images/backgrounds/about-bg.webp"/>' +
      '<link data-bwm-about-preload rel="preload" as="image" href="/assets/images/vendor/61d8ec3884b9494dba6f6b3a-orange-bird-11ae6441dae362b9.webp"/>\n</head>'
    );
  }

  if (
    file !== 'index.html' &&
    html.includes('home-mission-background') &&
    !html.includes('data-bwm-mission-preload') &&
    /<\/head>/i.test(html)
  ) {
    html = html.replace(
      /<\/head>/i,
      '<link data-bwm-mission-preload rel="preload" as="image" href="/assets/images/backgrounds/home-mission-bg.webp"/>\n</head>'
    );
  }

  if (file === 'wildlife/index.html' && wildlifeHero) {
    const preload = `<link data-bwm-wildlife-preload rel="preload" as="image" href="${wildlifeHero}"/>`;
    if (html.includes('data-bwm-wildlife-preload')) {
      html = html.replace(/<link data-bwm-wildlife-preload[^>]*>/i, preload);
    } else if (/<\/head>/i.test(html)) {
      html = html.replace(/<\/head>/i, `${preload}\n</head>`);
    }
  }

  if (file === 'index.html') {
    html = html.replace(
      /(<\/(?:div|p|h[1-6]|nav|form|label|option|select|li|ul|ol|section|footer|header|main)>)[\t\r\n]*/gi,
      '$1\n'
    );
  }

  if (html !== original) {
    writeFileSync(`${root}/${file}`, html);
    changedFiles += 1;
  }
}

console.log(
  `Localized ${urls.size} assets; updated ${changedFiles} HTML files; ` +
  `deferred ${deferredImages} images; removed ${removedAnalyticsTags} duplicate analytics tags.`
);
