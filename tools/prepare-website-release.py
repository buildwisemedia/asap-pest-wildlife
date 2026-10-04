#!/usr/bin/env python3
"""Build a deployable folder. This does not deploy or assert human approval.

Review is the default. --production-candidate prepares the exact post-approval
version for checks; publication remains a separate, explicit release step.
"""
from pathlib import Path
import argparse, shutil, re, json, hashlib
import xml.etree.ElementTree as ET

parser=argparse.ArgumentParser()
parser.add_argument('--output',required=True)
parser.add_argument('--production-candidate',action='store_true')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1];out=Path(args.output).resolve()
if out.exists(): raise SystemExit('Output must be a new folder to prevent stale files.')
out.mkdir(parents=True)
skip={'content','_verification','.git','tools','qa','tests','node_modules','website-review','lead-flow'}
public_ext={'.html','.css','.js','.json','.txt','.xml','.svg','.png','.jpg','.jpeg','.webp','.ico','.woff','.woff2','.ttf','.otf','.pdf','.webmanifest','.avif','.ts'}
for p in root.rglob('*'):
    rel=p.relative_to(root)
    if not p.is_file() or rel.parts[0] in skip or any(x.startswith('.') for x in rel.parts): continue
    if p.name.endswith(('.test.js','.test.mjs')) or p.suffix not in public_ext and p.name not in {'_headers','_redirects'}: continue
    dst=out/rel;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dst)
if not args.production_candidate: shutil.copytree(root/'website-review',out/'website-review')

for p in out.rglob('*.html'):
    html=p.read_text()
    if args.production_candidate:
        html=re.sub(r'<script src="/assets/js/asap-review-mode.js"></script>\s*','',html)
        html=html.replace(' disabled data-review-disable','')
        if p.relative_to(out).parts[0] not in {'rate','404.html'}:
            html=re.sub(r'<meta\s+name=["\']robots["\'][^>]*>\s*','',html,flags=re.I)
        html=html.replace('data-build-state="local-review"','data-build-state="production"')
        html=html.replace('data-integration-state="fixture-only"','data-integration-state="live"')
        html=re.sub(r'(<button[^>]*data-fixture-submit[^>]*>).*?(</button>)',r'\1Send request\2',html)
        html=re.sub(r'<noscript><p class="form-status">.*?</p></noscript>','<noscript><p>Please call 770-691-3636 to request help. Online forms need JavaScript.</p></noscript>',html)
        html=html.replace('This review form does not send a request or create a customer record.','Your details will be sent to the ASAP team when you choose Send request.')
        if '/assets/js/bwm-analytics.js' not in html:
            html=html.replace('</head>','<script defer src="/assets/js/bwm-analytics.js"></script></head>')
        if '/attribution.js' not in html: html=html.replace('</body>','<script src="/attribution.js" defer></script></body>')
    p.write_text(html)

headers=(out/'_headers').read_text()
if args.production_candidate:
    headers=re.sub(r'# PRIVATE REVIEW HOLD:.*', '', headers, flags=re.S)
else:
    headers+='\n/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n'
(out/'_headers').write_text(headers)
redirects=out/'_redirects'
if args.production_candidate:
    with redirects.open('a') as f:
        f.write('\n# The rodent umbrella replaces the older review-only route.\n/peace-of-mind-from/rodents/ /rodent-removal/ 301\n/peace-of-mind-from/rodents /rodent-removal/ 301\n')
    shutil.rmtree(out/'peace-of-mind-from/rodents',ignore_errors=True)
    ns='http://www.sitemaps.org/schemas/sitemap/0.9';ET.register_namespace('',ns)
    tree=ET.parse(out/'sitemap.xml');urlset=tree.getroot()
    for u in list(urlset):
        loc=u.find('{'+ns+'}loc')
        if loc is not None and any(x in loc.text for x in ['/peace-of-mind-from/rodents','/lead-flow','/website-review','/rate']):urlset.remove(u)
    existing={n.text for n in urlset.iter('{'+ns+'}loc')}
    extra=['rodent-removal']+['wildlife-removal-'+x for x in ['canton','woodstock','acworth','kennesaw','cartersville']]
    extra += ['blog/'+x for x in ['raccoon-signs-and-next-steps','bat-removal-georgia-maternity-season','rat-signs-and-next-steps']]
    for route in extra:
        url='https://removeasap.com/'+route+'/'
        if url not in existing: ET.SubElement(ET.SubElement(urlset,'{'+ns+'}url'),'{'+ns+'}loc').text=url
    tree.write(out/'sitemap.xml',encoding='unicode',xml_declaration=True)
    (out/'assets/js/asap-review-mode.js').unlink(missing_ok=True)
manifest={str(p.relative_to(out)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(out.rglob('*')) if p.is_file()}
receipt=out.parent/(out.name+'-manifest.json')
receipt.write_text(json.dumps({'mode':'production-candidate' if args.production_candidate else 'review','published':False,'human_approval':False,'files':manifest},indent=2)+'\n')
print(json.dumps({'files':len(manifest),'output':str(out),'manifest':str(receipt),'published':False}))
