#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const publicFormSkip = new Set(['lead-flow/index.html']);
const canonicalPhone = '7706913636';

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === '_audit' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function rel(file) {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

function htmlRouteExists(href) {
  const clean = href.split('#')[0].split('?')[0];
  if (!clean || clean === '/') return fs.existsSync(path.join(root, 'index.html'));
  const normalized = clean.replace(/^\/+/, '').replace(/\/+$/, '');
  const candidates = [
    path.join(root, normalized),
    path.join(root, normalized, 'index.html'),
    path.join(root, `${normalized}.html`)
  ];
  return candidates.some((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
}

function extractAttrs(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/([a-zA-Z0-9_:-]+)\s*=\s*["']([^"']*)["']/g)) {
    attrs[match[1].toLowerCase()] = match[2];
  }
  return attrs;
}

async function fetchStatus(base, href) {
  const url = new URL(href, base).toString();
  try {
    const res = await fetch(url, { redirect: 'follow' });
    return { url, status: res.status, ok: res.status >= 200 && res.status < 400 };
  } catch (error) {
    return { url, status: 0, ok: false, error: error.message };
  }
}

const args = process.argv.slice(2);
const baseIndex = args.indexOf('--base');
const base = baseIndex >= 0 ? args[baseIndex + 1] : null;
const htmlFiles = walk(root);
const publicHtmlFiles = htmlFiles.filter((file) => rel(file) !== 'lead-flow/index.html');

const report = {
  generated_at: new Date().toISOString(),
  root,
  public_html_pages: publicHtmlFiles.length,
  forms: [],
  unsupported_form_types: [],
  missing_form_handler: [],
  missing_attribution_on_form_pages: [],
  phone_links: [],
  bad_phone_links: [],
  email_placeholders: [],
  internal_links: [],
  broken_static_internal_links: [],
  fetch_base: base,
  fetch_failures: []
};

for (const file of htmlFiles) {
  const fileRel = rel(file);
  const text = fs.readFileSync(file, 'utf8');
  const isPublicFormPage = text.includes('<form') && !publicFormSkip.has(fileRel);

  if (isPublicFormPage) {
    const formTypes = new Set();
    for (const match of text.matchAll(/payload\.formType\s*=\s*['"]([^'"]+)['"]|formType\s*:\s*['"]([^'"]+)['"]/g)) {
      formTypes.add(match[1] || match[2]);
    }
    const formTypeList = [...formTypes].sort();
    report.forms.push({
      file: fileRel,
      form_count: (text.match(/<form\b/g) || []).length,
      form_types: formTypeList,
      has_lead_flow_script: text.includes('/assets/js/asap-lead-flow.js'),
      has_attribution: text.includes('/attribution.js'),
      has_bwm_endpoint: text.includes('bwm-form-handler.robert-ba0.workers.dev/submit')
    });
    for (const formType of formTypeList) {
      if (formType !== 'contact') report.unsupported_form_types.push({ file: fileRel, formType });
    }
    if (!text.includes('/assets/js/asap-lead-flow.js') && !text.includes('bwm-form-handler.robert-ba0.workers.dev/submit')) {
      report.missing_form_handler.push(fileRel);
    }
    if (!text.includes('/attribution.js')) report.missing_attribution_on_form_pages.push(fileRel);
  }

  for (const match of text.matchAll(/<a\b[^>]*>/g)) {
    const tag = match[0];
    const attrs = extractAttrs(tag);
    const href = attrs.href || '';
    if (!href) continue;
    if (/^tel:/i.test(href)) {
      const digits = href.replace(/\D/g, '');
      const entry = { file: fileRel, href, digits };
      report.phone_links.push(entry);
      if (digits !== canonicalPhone) report.bad_phone_links.push(entry);
      continue;
    }
    if (href === '#') {
      const after = text.slice(match.index, match.index + 220);
      if (/info@/i.test(after)) report.email_placeholders.push({ file: fileRel, href });
      continue;
    }
    if (/^(mailto:|https?:|#|javascript:)/i.test(href)) continue;
    const entry = { file: fileRel, href };
    report.internal_links.push(entry);
    if (!htmlRouteExists(href)) report.broken_static_internal_links.push(entry);
  }
}

if (base) {
  const uniqueHrefs = [...new Set(report.internal_links.map((entry) => entry.href.split('#')[0]).filter(Boolean))].sort();
  for (const href of uniqueHrefs) {
    const result = await fetchStatus(base, href);
    if (!result.ok) report.fetch_failures.push({ href, ...result });
  }
}

report.summary = {
  public_form_pages: report.forms.length,
  unsupported_form_type_count: report.unsupported_form_types.length,
  missing_form_handler_count: report.missing_form_handler.length,
  missing_attribution_on_form_pages_count: report.missing_attribution_on_form_pages.length,
  phone_link_count: report.phone_links.length,
  bad_phone_link_count: report.bad_phone_links.length,
  email_placeholder_count: report.email_placeholders.length,
  internal_link_count: report.internal_links.length,
  broken_static_internal_link_count: report.broken_static_internal_links.length,
  fetch_failure_count: report.fetch_failures.length
};

console.log(JSON.stringify(report, null, 2));

if (
  report.summary.unsupported_form_type_count ||
  report.summary.missing_form_handler_count ||
  report.summary.missing_attribution_on_form_pages_count ||
  report.summary.bad_phone_link_count ||
  report.summary.email_placeholder_count ||
  report.summary.broken_static_internal_link_count ||
  report.summary.fetch_failure_count
) {
  process.exitCode = 1;
}
