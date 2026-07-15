#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const htmlFiles = execFileSync('git', ['ls-files', '-z', '--', '*.html'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const imageMap = new Map([
  ['699f35309ec99464106dc35a_ASAP_LOGO_Orange.png', '/assets/images/logos/logo-orange.webp'],
  ['61aea59de7f1b769c777f498_orange-mascot.svg', 'https://cdn.prod.website-files.com/61a68c3ac2bbdc9f4c356d55/61aea59de7f1b769c777f498_orange-mascot.svg'],
  ['69a16d349bf9eb29fd93bcda_ASAP_MONSTER_ICON.png', '/assets/images/logos/monster-icon.png'],
  ['64d7de35012c1f27af71ba11_ANT%20%5BConverted%5D.webp', '/assets/images/animals/ant-optimized.webp'],
  ['64de6e74e79a0a2a8b955fc4', '/assets/images/animals/squirrel-optimized.webp'],
  ['620abe342381511ec50d164f_raccoon.png', '/assets/images/animals/raccoon-optimized.webp'],
  ['620abdda12d1acde7526c20e_groundhog.png', '/assets/images/animals/groundhog-optimized.webp'],
  ['620abff3f75afb7e4b147191_armadillo.png', '/assets/images/animals/armadillo-optimized.webp'],
  ['rat-navy.png', '/assets/images/animals/rat-navy-optimized.webp'],
  ['61d91a1d697fbd514db4a0cb_bee.png', '/assets/images/animals/bee-optimized.webp'],
  ['andmore.png', '/assets/images/animals/andmore-optimized.webp'],
  ['beaver-navy.png', '/assets/images/animals/beaver-navy-optimized.webp'],
  ['61d906abb1f71ca87a357fdc_beaver.png', '/assets/images/wildlife-grid/beaver.webp'],
  ['61d906428b986e4f864faf40_coyote.png', '/assets/images/wildlife-grid/coyote.webp'],
  ['61d90636b70812fdd9c9a4d4_raccoon.png', '/assets/images/wildlife-grid/raccoon.webp'],
  ['61d9066925700240d671b492_snake.png', '/assets/images/wildlife-grid/snake.webp'],
  ['mark.png', '/assets/images/reviews/mark.webp'],
  ['kels.png', '/assets/images/reviews/kelsey.webp'],
  ['fred.png', '/assets/images/reviews/fred.webp'],
  ['charlie.png', '/assets/images/reviews/charlie.webp'],
  ['yashica.png', '/assets/images/reviews/yashica.webp'],
  ['benjamin.png', '/assets/images/reviews/benjamin.webp'],
]);

const deferredTypekit = `<script>/* Brand fonts load after intent while fallback text remains visible. */
(function(){var done=false;function load(){if(done)return;done=true;var s=document.createElement('script');s.async=true;s.src='https://use.typekit.net/dmg8gvn.js';s.onload=function(){try{Typekit.load({async:true});}catch(e){}};document.head.appendChild(s);}['pointerdown','keydown','touchstart','scroll'].forEach(function(e){window.addEventListener(e,load,{once:true,passive:true});});window.addEventListener('load',function(){setTimeout(load,15000);},{once:true});})();</script>`;

let changedFiles = 0;
let replacedImages = 0;

for (const file of htmlFiles) {
  const before = readFileSync(file, 'utf8');
  let html = before;

  // Remove our generated includes first so reruns remain idempotent and pages
  // that do not use the Webflow design system receive no extra requests.
  html = html.replace(/<link href="\/assets\/css\/performance\.css" rel="stylesheet"\/>\s*/gi, '');
  html = html.replace(/<script>\/\* Brand fonts load (?:after the first useful paint|asynchronously while fallback text remains visible|after intent while fallback text remains visible)\. \*\/[\s\S]*?<\/script>\s*/gi, '');
  const usesWebflowDesign = /asap-wildlife-removal\.webflow\.shared|use\.typekit\.net|Typekit\.load/i.test(html);

  html = html.replace(/\sdata-wf-intellimize-customer-id=(?:"[^"]*"|'[^']*')/gi, '');
  html = html.replace(/\sdata-wf-hidden-variation(?:=(?:"[^"]*"|'[^']*'))?/gi, '');
  html = html.replace(/<style\b[^>]*>\s*\.anti-flicker[\s\S]*?<\/style>/gi, '');
  html = html.replace(/<style\b[^>]*>\s*\[data-wf-hidden-variation\][\s\S]*?<\/style>/gi, '');
  html = html.replace(/<link\b[^>]*(?:intellimize\.co|intellimizeio\.com)[^>]*\/?\s*>/gi, '');
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (tag) => {
    if (/intellimize|\/g0lnomhfn3mg/i.test(tag)) return '';
    if (/use\.typekit\.net|Typekit\.load/i.test(tag)) return '';
    if (/clarity_script-/i.test(tag)) return '';
    return tag;
  });

  // The exported Webflow runtime is still required for navigation and sliders,
  // but fetching it must not pause HTML parsing.
  html = html.replace(/<script\b[^>]*\bsrc="[^"]+"[^>]*><\/script>/gi, (tag) => {
    if (/\bdefer(?:="")?/i.test(tag)) return tag;
    if (/bwm-analytics\.js|\/assets\/js\/main\.js|jquery|\/js\/webflow\./i.test(tag)) {
      return tag.replace(/<script/i, '<script defer');
    }
    return tag;
  });

  html = html.replace(/<img\b[^>]*>/gi, (tag) => {
    for (const [needle, localPath] of imageMap) {
      if (!tag.includes(needle) && !tag.includes(localPath)) continue;
      replacedImages += 1;
      const provenance = tag.includes('data-original-asset=')
        ? tag
        : tag.replace(/<img/i, `<img data-original-asset="${needle}"`);
      return provenance
        .replace(/\ssrcset=(?:"[^"]*"|'[^']*')/gi, '')
        .replace(/\ssizes=(?:"[^"]*"|'[^']*')/gi, '')
        .replace(/\ssrc=(?:"[^"]*"|'[^']*')/i, ` src="${localPath}"`);
    }
    return tag;
  });

  if (usesWebflowDesign && !html.includes('/assets/css/performance.css') && /<\/head>/i.test(html)) {
    html = html.replace(/<\/head>/i, '<link href="/assets/css/performance.css" rel="stylesheet"/>\n</head>');
  }
  if (usesWebflowDesign && !html.includes('Brand fonts load after intent while fallback text remains visible') && /<\/head>/i.test(html)) {
    html = html.replace(/<\/head>/i, `${deferredTypekit}\n</head>`);
  }

  if (html !== before) {
    writeFileSync(file, html);
    changedFiles += 1;
  }
}

console.log(`Updated ${changedFiles} HTML files; replaced ${replacedImages} image references.`);
