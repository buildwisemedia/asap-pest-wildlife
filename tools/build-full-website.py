#!/usr/bin/env python3
"""Compose the reviewed ASAP pages and article bodies into one approval site.

Run after the existing animal and city builders. No publishing or email side effects.
"""
from pathlib import Path
import re, json, hashlib
from html import escape
from bs4 import BeautifulSoup
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ANIMALS = [('Rodent removal','rodent-removal'),('Rat and mouse removal','wildlife/mouse-rat'),
           ('Squirrel removal','wildlife/gray-squirrel'),('Raccoon removal','wildlife/raccoon'),('Bat removal','wildlife/bats')]
CITIES = [(name, 'wildlife-removal-'+name.lower()) for name in ['Canton','Woodstock','Acworth','Kennesaw','Cartersville']]
ARTICLES = [('raccoon','raccoon-signs-and-next-steps','wildlife/raccoon'),
            ('bat','bat-removal-georgia-maternity-season','wildlife/bats'),
            ('rat','rat-signs-and-next-steps','wildlife/mouse-rat')]
IMAGES = [('House mouse','house-mouse'),('Norway rat','norway-rat'),('Gray squirrel','gray-squirrel'),('Flying squirrel','flying-squirrel')]

def write(path, data):
    p=ROOT/path; p.parent.mkdir(parents=True,exist_ok=True); p.write_text(data)
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def section_replace(text, key, content):
    pattern=rf'<!-- full-website:{key}:start -->.*?<!-- full-website:{key}:end -->'
    return re.sub(pattern,'',text,flags=re.S)

base=(ROOT/'wildlife/raccoon/index.html').read_text()
header=re.search(r'<header class="site-header">.*?</header>',base,re.S).group()
footer=re.search(r'<footer class="site-footer">.*?</footer>',base,re.S).group()
css_link='<link rel="stylesheet" href="/assets/css/asap-animal-v2.css?v=1">'
rows=[]
for key, slug, service in ARTICLES:
    source=ROOT/'content/articles'/key/'index.html'
    html=source.read_text()
    soup=BeautifulSoup(html,'html.parser')
    title=soup.h1.get_text(' ',strip=True)
    description=soup.select_one('meta[name="description"]')['content']
    content_before=soup.select_one('article.content').get_text(' ',strip=True)
    style=soup.style.string
    for cls in ['hero','brand','phone','footer','skip']:
        style=re.sub(r'\.'+cls+r'(?![\w-])','.editorial-'+cls,style)
        for el in soup.select('.'+cls):
            el['class']=['editorial-'+x if x==cls else x for x in el['class']]
    main=soup.main;main['id']='main';main['class']=['asap-editorial']
    for a in main.select('a[href="https://removeasap.com/"]'):
        a['href']='/' if a.get_text(' ',strip=True)=='removeasap.com' else '/'+service+'/'
    image=main.select_one('figure img'); original=ROOT/'content/articles'/key/image['src']
    image_path=f'assets/images/articles/{key}-hero-v1.webp'
    (ROOT/image_path).parent.mkdir(parents=True,exist_ok=True)
    with Image.open(original) as im:
        im.thumbnail((1440,1000));im.save(ROOT/image_path,'WEBP',quality=86,method=6)
        image['width'],image['height']=map(str,im.size)
    image['src']='/'+image_path
    canonical='https://removeasap.com/blog/'+slug+'/'
    schema={'@context':'https://schema.org','@type':'Article','headline':title,'description':description,
            'mainEntityOfPage':canonical,'image':'https://removeasap.com/'+image_path,
            'publisher':{'@type':'Organization','name':'ASAP Pest & Wildlife Removal','url':'https://removeasap.com/'}}
    page=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(title)} | ASAP Pest &amp; Wildlife Removal</title><meta name="description" content="{escape(description,quote=True)}"><meta name="robots" content="noindex,nofollow,noarchive">
<link rel="canonical" href="{canonical}"><meta property="og:type" content="article"><meta property="og:title" content="{escape(title,quote=True)}"><meta property="og:description" content="{escape(description,quote=True)}"><meta property="og:url" content="{canonical}"><meta property="og:image" content="https://removeasap.com/{image_path}"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/assets/images/logos/favicon.png">
{css_link}<style>{style}</style><script type="application/ld+json">{json.dumps(schema).replace('<','&lt;')}</script></head><body class="animal-page"><a class="skip-link" href="#main">Skip to the article</a>{header}{main}{footer}<script src="/assets/js/asap-close.js" defer></script></body></html>'''
    write('blog/'+slug+'/index.html',page)
    assert BeautifulSoup(page,'html.parser').select_one('article.content').get_text(' ',strip=True)==content_before
    rows.append({'key':key,'title':title,'description':description,'path':'/blog/'+slug+'/', 'service':'/'+service+'/',
                 'source_sha256':digest(source),'body_text_sha256':hashlib.sha256(content_before.encode()).hexdigest(),
                 'image':'/'+image_path,'original_image_sha256':digest(original),'image_sha256':digest(ROOT/image_path)})

def article_section(items):
    cards=''.join(f'<article class="article-card"><h3>{escape(x["title"])}</h3><p>{escape(x["description"])}</p><a href="{x["path"]}">Read the article <span aria-hidden="true">→</span></a></article>' for x in items)
    return '<!-- full-website:articles:start --><section class="section texture"><div class="container"><div class="section-heading"><p class="kicker">Learn before you decide</p><h2>Signs and next steps</h2></div><div class="article-grid">'+cards+'</div></div></section><!-- full-website:articles:end -->'

figures=''.join(f'''<figure><!-- @r020:F4 curiosity: labeled generated reference prompts a discussion with an inspector; never job evidence -->
<a href="/assets/images/droppings/droppings-{key}.jpg"><img src="/assets/images/droppings/droppings-{key}.jpg" width="1200" height="900" loading="lazy" alt="AI-generated {label.lower()} droppings illustration for review"></a><figcaption><strong>{label}</strong> · AI-generated illustration. Ask an inspector to confirm the animal.</figcaption></figure>''' for label,key in IMAGES)
droppings='''<!-- full-website:droppings:start --><section id="droppings" class="section section--white"><div class="container"><div class="section-heading"><p class="kicker">Clues to share with your inspector</p><h2>Droppings can look alike</h2></div><p class="lead">These images are illustrations, not proof of the animal in your home. Take photos from a safe distance. Do not touch or disturb droppings.</p><div class="review-images">'''+figures+'</div></div></section><!-- full-website:droppings:end -->'
for name, route in ANIMALS:
    path=ROOT/route/'index.html';html=path.read_text()
    html=section_replace(html,'articles','');html=section_replace(html,'droppings','')
    items=[x for x in rows if x['service']=='/'+route+'/']
    if items: html=html.replace('<section class="section texture" aria-labelledby="reviews-title">',article_section(items)+'<section class="section texture" aria-labelledby="reviews-title">')
    if route=='rodent-removal': html=html.replace('<section class="section texture" aria-labelledby="reviews-title">',droppings+'<section class="section texture" aria-labelledby="reviews-title">')
    path.write_text(html)

# Keep the existing blog and its older links; add the three completed site articles.
p=ROOT/'blog/index.html';html=section_replace(p.read_text(),'blog','');soup=BeautifulSoup(html,'html.parser')
cards=''.join(f'''<article><!-- @r020:F4 curiosity: labeled article image introduces the signs discussed in the linked article --><a href="{x['path']}"><img src="{x['image']}" width="1440" height="810" loading="lazy" alt="AI-generated {x['key']} article illustration"><h3>{escape(x['title'])}</h3></a><p>{escape(x['description'])}</p></article>''' for x in rows)
block='<!-- full-website:blog:start --><section class="asap-new-articles" aria-label="New wildlife articles"><h2>Signs and next steps</h2><div class="article-grid">'+cards+'</div></section><!-- full-website:blog:end -->'
heading=soup.h1
assert heading
raw=str(heading);assert html.count(raw)==1
html=html.replace(raw,raw+block);p.write_text(html)

def links(items):return '<ul class="review-links">'+''.join(f'<li><a href="{("/"+route.strip("/")+"/") if route.strip("/") else "/"}">{escape(name)}</a></li>' for name,route in items)+'</ul>'
main=f'''<main id="main" class="review-overview"><p class="kicker">ASAP · Complete website approval</p><h1>One website. One full review.</h1><p>All five animal pages, five city pages, three articles, and four droppings images are here for approval together. This is the complete review package. Use the links below, then reply to the team with your approval or a list of changes.</p><p><strong>Preview only:</strong> these changes are not live on removeasap.com. Forms in this preview send nothing. Phone and email links are real.</p>
<section><h2>Animal pages</h2><p>Nehemiah: review the wording, service details, and images across all five pages.</p>{links(ANIMALS)}</section>
<section><h2>City pages</h2><p>James: review all five cities for local accuracy and service fit.</p>{links(CITIES)}</section>
<section><h2>All three articles</h2><p>Nehemiah: review these together with the pages. Each article includes its full text, image, and source links.</p>{links([(x['title'],x['path']) for x in rows])}</section>
<section><h2>Four droppings images</h2><p>Nehemiah: please check the shape, scale, and species labels for all four images. They are AI-generated illustrations, not photos from customer jobs. The rodent page shows them in place.</p><div class="review-images">{figures}</div></section>
<section><h2>Shared website pages</h2>{links([('Home',''),('About','about'),('Wildlife directory','wildlife'),('Services','services'),('Pest control','pest-control-services'),('Commercial services','commercial-services'),('Blog','blog'),('Contact and forms','contact'),('Warranty','warranty-assurance'),('Privacy policy','privacy-policy'),('Terms of service','terms-of-service')])}<p><a href="/rate/?preview=1">Customer rating page</a> · Includes the requested heading style.</p></section>
<section><h2>Approve the full package</h2><p>Please reply to the team with either your approval for all items in your section or the page name and changes needed. For the inspection steps, this version uses the simple flashlight graphic shown on the animal pages. Please include any change to that graphic in the same reply.</p><p>After approval, the team will publish the approved pages and check the live forms, links, and search settings. Older article links stay available until their new pages are live.</p></section></main>'''
write('website-review/index.html',f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>ASAP — Complete Website Approval</title>{css_link}</head><body class="animal-page"><a class="skip-link" href="#main">Skip to the review</a>{header}{main}{footer}<script src="/assets/js/asap-close.js" defer></script></body></html>')

# Preserve the current public rating implementation; apply only the requested title type.
p=ROOT/'rate/index.html';html=p.read_text()
if '#page-title {' not in html: html=html.replace('    h2 {','    #page-title { font-family: urw-din, sans-serif; font-weight: 900; }\n\n    h2 {',1)
if '/privacy-policy/' not in html:
    html=html.replace('</footer>','<p><a href="/privacy-policy/">Privacy</a> · <a href="/terms-of-service/">Terms</a></p></footer>')
p.write_text(html)

for p in ROOT.rglob('*.html'):
    rel=p.relative_to(ROOT)
    if rel.parts[0] in {'content','_verification','node_modules','.git'}: continue
    html=p.read_text()
    # Repair malformed legacy Webflow closing tags that exposed CSS as page text.
    html=re.sub(r'</style(?=\s*<)', '</style>', html, flags=re.I)
    if '<head>' not in html: continue
    if '/assets/js/asap-review-mode.js' not in html:
        html=html.replace('<head>','<head>\n<script src="/assets/js/asap-review-mode.js"></script>\n<link rel="stylesheet" href="/assets/css/asap-website-review.css">',1)
    if not re.search(r'<meta\s+name=["\']robots["\']',html,re.I):
        html=html.replace('<head>','<head>\n<meta name="robots" content="noindex,nofollow,noarchive" data-website-review-robots>',1)
    def disable_submit(match):
        tag=match.group()
        if re.search(r'\bdisabled\b',tag): return tag
        return tag[:-1]+' disabled data-review-disable>'
    html=re.sub(r'<(?:input|button)\b[^>]*\btype=["\']submit["\'][^>]*>',disable_submit,html,flags=re.I)
    # Restore each older form label's link to its own adjacent input.
    html=re.sub(r'(<input\b[^>]*\bid="([^"]+)"[^>]*>\s*<label\b[^>]*\bfor=")[^"]+("[^>]*>)',lambda m:m[1]+m[2]+m[3],html)
    if 'data-asap-lead-form' in html:
        # Let the existing attribution script create populated fields from its cookie.
        html=re.sub(r'<input type="hidden" name="(?:utm_source|utm_medium|utm_campaign|gclid|fbclid)">','',html)
        if '/attribution.js' not in html: html=html.replace('</body>','<script src="/attribution.js" defer></script></body>')
    p.write_text(html)
write('content/design/full-website/article-integration.json',json.dumps({'articles':rows,'body_text_preserved':True,'client_approval':False},indent=2)+'\n')
print(json.dumps({'animal_pages':5,'city_pages':5,'articles':3,'droppings_images':4,'review':'/website-review/'}))
