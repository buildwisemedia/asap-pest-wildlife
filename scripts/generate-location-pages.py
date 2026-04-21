#!/usr/bin/env python3
"""Generate /locations/<slug>/index.html for each North-GA service area.

Run from repo root:
    python3 scripts/generate-location-pages.py

Each page is ~450 words with 3-4 city-specific paragraphs (local pest/wildlife
signals, neighborhoods, landmarks) and a LocalBusiness JSON-LD with areaServed
pointing to the city. Tailwind scaffold matches /about/index.html.
"""
from __future__ import annotations

import os
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_ROOT = ROOT / "locations"

# ------------------------------------------------------------------
# Per-city data (all publicly verifiable — landmarks, ZIPs, patterns)
# ------------------------------------------------------------------
CITIES = [
    {
        "slug": "cartersville",
        "name": "Cartersville",
        "county": "Bartow County",
        "zips": ["30120", "30121"],
        "lat": 34.1651,
        "lng": -84.7999,
        "meta_desc": (
            "Pest control and wildlife removal in Cartersville, GA. "
            "ASAP handles termites, rodents, beavers and more in Bartow County — "
            "older downtown homes, Allatoona Lake and the Etowah River corridor."
        ),
        "hero_sub": "Bartow County's full-service pest & wildlife team.",
        "intro": (
            "Cartersville homes and businesses have a character all their own — "
            "the downtown historic district, the Etowah Indian Mounds just south "
            "of town, and the wooded lots along Red Top Mountain. All of it is "
            "beautiful, and all of it gives pests and wildlife plenty of room to "
            "move in. ASAP Pest & Wildlife Removal serves every ZIP in Cartersville "
            "(30120 and 30121) and the surrounding Bartow County communities."
        ),
        "wildlife_para": (
            "Because so much of Cartersville sits along the Etowah River and the "
            "west shore of Allatoona Lake, we see a steady pattern of water-drawn "
            "wildlife: beavers damming creek tributaries, raccoons working "
            "garbage cans in the older neighborhoods near downtown, and bats "
            "tucked into the soffits of Cartersville's pre-war housing stock. "
            "Our team is licensed by the Georgia DNR to humanely trap and "
            "relocate every one of these."
        ),
        "pest_para": (
            "On the pest side, the age of Cartersville's housing is the story. "
            "Older wood-frame homes around Clarence and Cassville give "
            "subterranean termites easy access through cracked slabs and crawl "
            "space piers, and carpenter ants thrive in damp wood anywhere the "
            "grading isn't perfect. If you're buying an older Cartersville "
            "home, a termite inspection from ASAP before you close is worth "
            "every minute it takes."
        ),
        "neighborhoods": ["Downtown Cartersville", "Clarence", "Cassville", "Emerson", "Euharlee"],
    },
    {
        "slug": "acworth",
        "name": "Acworth",
        "county": "Cobb County",
        "zips": ["30101", "30102"],
        "lat": 34.0663,
        "lng": -84.6783,
        "meta_desc": (
            "Pest control and wildlife removal in Acworth, GA. "
            "ASAP serves Lake Acworth, Lake Allatoona and Cobb County "
            "neighborhoods — raccoons, snakes, mosquitoes and more."
        ),
        "hero_sub": "Lakeside Cobb County's pest & wildlife specialists.",
        "intro": (
            "Acworth's personality is its water. Between Lake Acworth and the "
            "southeast shore of Lake Allatoona, thousands of homes sit within "
            "walking distance of a dock or a swim beach — which is wonderful for "
            "weekends and a magnet for the wildlife and insects that follow the "
            "water. ASAP Pest & Wildlife Removal covers every ZIP in Acworth "
            "(30101 and 30102) and the Cobb County neighborhoods around both lakes."
        ),
        "wildlife_para": (
            "Lakefront properties bring a specific pattern of wildlife calls. We "
            "handle Canada goose exclusion on shoreline lawns in Brookstone and "
            "Centennial Lakes, water snakes and the occasional copperhead near "
            "Cauble Park and Bentwater, and raccoons and opossums that follow "
            "the shoreline trash routes overnight. Our Georgia-DNR-licensed "
            "technicians trap, relocate and — just as important — seal entry "
            "points so the same animal doesn't come back next week."
        ),
        "pest_para": (
            "Mosquitoes deserve their own paragraph in Acworth. Any home within "
            "a quarter mile of standing water is on the mosquito map, and our "
            "perimeter treatments and dock-structure services give you back the "
            "evenings on the porch. On top of that, carpenter bees love wooden "
            "docks and pergolas, and we see a steady run of spider and ant calls "
            "from the older Lake Acworth subdivisions every spring."
        ),
        "neighborhoods": ["Brookstone", "Centennial Lakes", "Bentwater", "Cauble Park", "Lakeside at Acworth"],
    },
    {
        "slug": "kennesaw",
        "name": "Kennesaw",
        "county": "Cobb County",
        "zips": ["30144", "30152"],
        "lat": 34.0234,
        "lng": -84.6155,
        "meta_desc": (
            "Pest control and wildlife removal in Kennesaw, GA. "
            "ASAP handles coyotes, foxes, raccoons and more near Kennesaw "
            "Mountain National Park and across Cobb County."
        ),
        "hero_sub": "Serving Kennesaw Mountain's edge neighborhoods.",
        "intro": (
            "Living in Kennesaw means living next door to 2,965 acres of "
            "federally protected forest at Kennesaw Mountain National "
            "Battlefield Park. That's a gift — and it's also a steady source of "
            "wildlife pressure on every neighborhood that backs up to the park. "
            "ASAP Pest & Wildlife Removal covers all of Kennesaw (30144 and "
            "30152) and works the park-edge subdivisions from Stilesboro to "
            "Barrett Parkway."
        ),
        "wildlife_para": (
            "The park-edge pattern is clear. Coyotes and foxes use the park as "
            "a daytime refuge and fan out into the neighborhoods at dawn and "
            "dusk — we get a lot of small-pet and chicken-coop calls from Legacy "
            "Park and the Stilesboro side. Raccoons and deer push into "
            "residential trash and vegetable gardens year round. And when homes "
            "back directly onto park trails, we occasionally handle snake and "
            "bat removals that simply wouldn't happen in more urban Cobb County."
        ),
        "pest_para": (
            "On the pest side, proximity to the woods means ticks — and ASAP's "
            "perimeter treatments around park-adjacent yards are one of the "
            "most-requested services we run in Kennesaw. We also see steady "
            "demand from the student rental corridor around Kennesaw State "
            "University for German roach and bed bug work, and a large share "
            "of carpenter ant calls every spring from the wooded subdivisions."
        ),
        "neighborhoods": ["Legacy Park", "Stilesboro", "Barrett Parkway corridor", "Swift-Cantrell", "Kennesaw Due West"],
    },
    {
        "slug": "woodstock",
        "name": "Woodstock",
        "county": "Cherokee County",
        "zips": ["30188", "30189"],
        "lat": 34.1015,
        "lng": -84.5194,
        "meta_desc": (
            "Pest control and wildlife removal in Woodstock, GA. "
            "ASAP specializes in squirrel, bat and raccoon removal in "
            "Towne Lake and Cherokee County neighborhoods."
        ),
        "hero_sub": "The squirrel-in-the-attic capital of Cherokee County.",
        "intro": (
            "If there's one call we take more than any other in Woodstock, it's "
            "\"there's something in my attic.\" The densely wooded subdivisions "
            "around Towne Lake and out toward the Little River are gorgeous — "
            "mature oaks, established canopies, quiet streets — and every single "
            "one of those trees is a highway for gray squirrels, flying "
            "squirrels and bats looking for a dry place to nest. ASAP Pest & "
            "Wildlife Removal covers every Woodstock ZIP (30188 and 30189) and "
            "the surrounding Cherokee County communities."
        ),
        "wildlife_para": (
            "Our most common Woodstock wildlife job is a full attic remediation: "
            "trap and remove squirrels or bats, identify and seal every entry "
            "point (usually a gable vent, soffit gap or roof return), and "
            "clean up the contaminated insulation. We do this work on warranty, "
            "which matters — without a permanent exclusion, squirrels come "
            "straight back the next season. We also handle a steady run of "
            "raccoon and snake calls near the Little River and the older "
            "Eagle Watch and Woodlands subdivisions."
        ),
        "pest_para": (
            "Wooded lots mean wood pests. Carpenter ants, termites, wasps and "
            "hornets in the canopy, and mosquitoes wherever the drainage pools. "
            "Our perimeter and attic treatments are designed for Woodstock's "
            "housing stock specifically — crawl spaces, vaulted attics, and the "
            "brick-and-cedar construction that defines the Towne Lake subdivisions."
        ),
        "neighborhoods": ["Towne Lake", "Eagle Watch", "The Woodlands", "Bridge Mill", "Downtown Woodstock"],
    },
    {
        "slug": "canton",
        "name": "Canton",
        "county": "Cherokee County",
        "zips": ["30114", "30115"],
        "lat": 34.2367,
        "lng": -84.4907,
        "meta_desc": (
            "Pest control and wildlife removal in Canton, GA. "
            "ASAP handles coyotes, beavers, armadillos, rodents and more "
            "across Cherokee County's rural-suburban mix."
        ),
        "hero_sub": "Cherokee County's rural-edge wildlife specialists.",
        "intro": (
            "Canton is where Metro Atlanta starts to feel rural — larger lots, "
            "pasture-edge subdivisions, the Etowah River running through town, "
            "and a wildlife picture that's broader than anywhere else we serve. "
            "ASAP Pest & Wildlife Removal covers every Canton ZIP (30114 and "
            "30115) and the surrounding Cherokee County communities from "
            "BridgeMill up to Hickory Flat."
        ),
        "wildlife_para": (
            "The wildlife mix in Canton is the broadest we handle. Armadillos "
            "have pushed north into Cherokee County over the past decade and "
            "we now trap them regularly on the Great Sky side. Coyotes, foxes "
            "and opossums are everyday calls; beavers along the Etowah River "
            "cause flood and tree-loss damage year round; and we see more "
            "groundhog and woodchuck work here than anywhere else in our "
            "service area. All work is performed under Georgia DNR license."
        ),
        "pest_para": (
            "Rural-edge living brings ticks and fleas — and if you have "
            "outdoor dogs or livestock, our yard and outbuilding treatments "
            "are usually on a recurring schedule. Stinging insects (yellow "
            "jackets, hornets, wasps) are heavy in the summer months, and "
            "the older farmhouses around Hickory Flat see regular rodent work "
            "as temperatures drop each fall."
        ),
        "neighborhoods": ["BridgeMill", "Hickory Flat", "Great Sky", "River Green", "Downtown Canton"],
    },
]


# ------------------------------------------------------------------
# Page template (Tailwind scaffold matching /about/index.html style)
# ------------------------------------------------------------------
PAGE_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pest &amp; Wildlife Removal in {name}, GA | ASAP Pest &amp; Wildlife</title>
  <meta name="description" content="{meta_desc}">
  <link rel="canonical" href="https://removeasap.com/locations/{slug}/">
  <meta property="og:title" content="Pest &amp; Wildlife Removal in {name}, GA | ASAP">
  <meta property="og:description" content="{meta_desc}">
  <meta property="og:image" content="https://removeasap.com/assets/images/logos/logo-orange.png">
  <meta property="og:url" content="https://removeasap.com/locations/{slug}/">
  <meta property="og:type" content="website">
  <link rel="icon" type="image/png" href="/assets/images/logos/favicon.png">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {{
      theme: {{
        extend: {{
          colors: {{ navy: '#212936', 'navy-dark': '#1a2030', orange: '#B77537', 'orange-dark': '#9a6230', cream: '#F2EDDC', 'dark-text': '#222222' }},
          fontFamily: {{ sans: ['urw-din', 'Arial', 'Helvetica Neue', 'Helvetica', 'sans-serif'], heading: ['urw-din', 'Arial', 'Helvetica Neue', 'Helvetica', 'sans-serif'] }}
        }}
      }}
    }}
  </script>
  <script src="https://use.typekit.net/dmg8gvn.js"></script>
  <script>try{{Typekit.load({{async:true}});}}catch(e){{}}</script>
  <script>(function(w,d,s,l,i){{w[l]=w[l]||[];w[l].push({{'gtm.start':new Date().getTime(),event:'gtm.js'}});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);}})(window,document,'script','dataLayer','GTM-K953HZ9R');</script>
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-GQZJKG5JCK"></script>
  <script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}gtag('js',new Date());gtag('config','G-GQZJKG5JCK');</script>
  <link rel="stylesheet" href="/assets/css/style.css">

  <script type="application/ld+json">
  {{
    "@context": "https://schema.org",
    "@graph": [
      {{
        "@type": "LocalBusiness",
        "@id": "https://removeasap.com/locations/{slug}/#business",
        "name": "ASAP Pest & Wildlife Removal — {name}",
        "image": "https://removeasap.com/assets/images/logos/logo-orange.png",
        "url": "https://removeasap.com/locations/{slug}/",
        "telephone": "770-450-1744",
        "email": "info@removeasap.com",
        "priceRange": "$$",
        "address": {{ "@type": "PostalAddress", "addressLocality": "{name}", "addressRegion": "GA", "postalCode": "{primary_zip}", "addressCountry": "US" }},
        "geo": {{ "@type": "GeoCoordinates", "latitude": {lat}, "longitude": {lng} }},
        "openingHoursSpecification": {{ "@type": "OpeningHoursSpecification", "dayOfWeek": ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"], "opens": "00:00", "closes": "23:59" }},
        "areaServed": [
          {{ "@type": "City", "name": "{name}", "containedInPlace": {{ "@type": "AdministrativeArea", "name": "{county}" }} }}{zip_area_served}
        ]
      }},
      {{
        "@type": "BreadcrumbList",
        "@id": "https://removeasap.com/locations/{slug}/#breadcrumbs",
        "itemListElement": [
          {{ "@type": "ListItem", "position": 1, "name": "Home", "item": "https://removeasap.com/" }},
          {{ "@type": "ListItem", "position": 2, "name": "Service Areas", "item": "https://removeasap.com/locations/" }},
          {{ "@type": "ListItem", "position": 3, "name": "{name}, GA", "item": "https://removeasap.com/locations/{slug}/" }}
        ]
      }}
    ]
  }}
  </script>
</head>
<body class="bg-cream text-dark-text font-sans">
  <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-K953HZ9R" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>

  <!-- Top Bar -->
  <div class="bg-navy text-cream text-sm">
    <div class="max-w-7xl mx-auto px-4 py-2 flex flex-wrap justify-between items-center">
      <div class="flex items-center gap-4 flex-wrap">
        <a href="tel:7704501744" class="flex items-center gap-1 hover:text-orange transition-colors">
          <img src="/assets/images/icons/speechbubble.svg" alt="" class="w-4 h-4 invert">
          <span class="uppercase tracking-wider text-xs font-bold">Call now: 770-450-1744</span>
        </a>
        <a href="mailto:info@removeasap.com?subject=ASAP%20wildlife%20removal" class="flex items-center gap-1 hover:text-orange transition-colors">
          <img src="/assets/images/icons/email.svg" alt="" class="w-4 h-4 invert">
          <span class="uppercase tracking-wider text-xs font-bold">Or Email us for quote</span>
        </a>
      </div>
    </div>
  </div>

  <!-- Header -->
  <header class="bg-cream sticky top-0 z-50 border-b border-cream">
    <div class="max-w-7xl mx-auto px-4">
      <div class="flex items-center justify-between h-20">
        <a href="/" class="flex-shrink-0">
          <img src="/assets/images/logos/logo-orange-tagline.png" alt="ASAP Pest & Wildlife Removal" class="h-14 w-auto">
        </a>
        <nav class="hidden lg:flex items-center gap-8">
          <a href="/" class="text-navy font-bold text-sm uppercase tracking-[0.15em] hover:text-orange transition-colors">Home</a>
          <a href="/about/" class="text-navy font-bold text-sm uppercase tracking-[0.15em] hover:text-orange transition-colors">About</a>
          <a href="/wildlife/" class="text-navy font-bold text-sm uppercase tracking-[0.15em] hover:text-orange transition-colors">Wildlife</a>
          <a href="/pest-control-services/" class="text-navy font-bold text-sm uppercase tracking-[0.15em] hover:text-orange transition-colors">Pest Control</a>
          <a href="/commercial-services/" class="text-navy font-bold text-sm uppercase tracking-[0.15em] hover:text-orange transition-colors">Commercial</a>
          <a href="/services/" class="text-navy font-bold text-sm uppercase tracking-[0.15em] hover:text-orange transition-colors">Services</a>
          <a href="/blog/" class="text-navy font-bold text-sm uppercase tracking-[0.15em] hover:text-orange transition-colors">Blog</a>
        </nav>
        <button id="mobile-menu-btn" class="lg:hidden text-navy p-2" aria-label="Toggle menu">
          <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path id="menu-icon" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
      </div>
      <nav id="mobile-menu" class="hidden lg:hidden pb-4">
        <div class="flex flex-col gap-2">
          <a href="/" class="text-navy font-bold py-2 px-3 uppercase tracking-[0.15em] text-sm">Home</a>
          <a href="/about/" class="text-navy font-bold py-2 px-3 uppercase tracking-[0.15em] text-sm">About</a>
          <a href="/wildlife/" class="text-navy font-bold py-2 px-3 uppercase tracking-[0.15em] text-sm">Wildlife</a>
          <a href="/pest-control-services/" class="text-navy font-bold py-2 px-3 uppercase tracking-[0.15em] text-sm">Pest Control</a>
          <a href="/commercial-services/" class="text-navy font-bold py-2 px-3 uppercase tracking-[0.15em] text-sm">Commercial</a>
          <a href="/services/" class="text-navy font-bold py-2 px-3 uppercase tracking-[0.15em] text-sm">Services</a>
          <a href="/blog/" class="text-navy font-bold py-2 px-3 uppercase tracking-[0.15em] text-sm">Blog</a>
        </div>
      </nav>
    </div>
  </header>

  <main>
    <!-- Hero -->
    <section class="bg-navy relative overflow-hidden py-16 md:py-24">
      <img src="/assets/images/mascots/orange-bird.svg" alt="" class="hidden md:block absolute top-8 right-[8%] w-32 lg:w-40 opacity-70 z-10" loading="lazy">
      <img src="/assets/images/mascots/white-mascot.svg" alt="" class="hidden md:block absolute bottom-8 left-[5%] w-24 lg:w-32 opacity-60 z-10" loading="lazy">
      <div class="max-w-7xl mx-auto px-4 relative z-20">
        <p class="text-orange uppercase tracking-[0.2em] font-bold text-sm mb-4">{county} Service Area</p>
        <h1 class="font-heading font-black leading-[0.9]">
          <span class="block text-cream text-4xl md:text-6xl lg:text-7xl uppercase tracking-[0.05em]">Pest &amp; Wildlife</span>
          <span class="block text-cream text-4xl md:text-6xl lg:text-7xl uppercase tracking-[0.05em] mt-2">Removal in {name}</span>
        </h1>
        <p class="text-cream/70 mt-6 max-w-2xl">{hero_sub}</p>
        <div class="mt-8 flex flex-wrap gap-4">
          <a href="tel:7704501744" class="inline-block bg-orange text-white font-bold uppercase tracking-[0.15em] px-8 py-3 rounded-sm hover:bg-orange-dark transition-colors text-sm">Call (770) 450-1744</a>
          <a href="#contact" class="inline-block bg-transparent text-cream border-2 border-cream font-bold uppercase tracking-[0.15em] px-8 py-3 rounded-sm hover:bg-cream hover:text-navy transition-colors text-sm">Get an estimate</a>
        </div>
      </div>
    </section>

    <!-- CTA Banner -->
    <div class="bg-orange py-4" style="clip-path: polygon(0 0, 100% 0, 97% 100%, 0% 100%);">
      <div class="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-center gap-2 text-white">
        <span class="uppercase tracking-[0.15em] font-bold text-sm">For services and immediate attention in {name}</span>
        <a href="tel:7704501744" class="uppercase tracking-[0.15em] font-black text-lg hover:text-cream transition-colors">CALL NOW (770)450-1744</a>
      </div>
    </div>

    <!-- Intro -->
    <section class="bg-cream py-16 md:py-20">
      <div class="max-w-4xl mx-auto px-4">
        <nav aria-label="Breadcrumb" class="text-navy/60 text-xs uppercase tracking-[0.15em] mb-6">
          <a href="/" class="hover:text-orange">Home</a>
          <span class="mx-2">/</span>
          <a href="/locations/" class="hover:text-orange">Service Areas</a>
          <span class="mx-2">/</span>
          <span class="text-orange">{name}, GA</span>
        </nav>
        <p class="text-orange uppercase tracking-[0.2em] font-bold text-sm mb-4">ZIPs served: {zip_list}</p>
        <h2 class="font-heading font-black text-navy text-3xl md:text-4xl uppercase tracking-[0.1em] mb-6">{name}, {county}</h2>
        <div class="space-y-5 text-navy/80 leading-relaxed text-lg">
          <p>{intro}</p>
          <p>{wildlife_para}</p>
          <p>{pest_para}</p>
        </div>
      </div>
    </section>

    <!-- Neighborhoods served -->
    <section class="bg-navy py-14">
      <div class="max-w-4xl mx-auto px-4 text-center">
        <p class="text-orange uppercase tracking-[0.2em] font-bold text-sm mb-4">Neighborhoods we cover</p>
        <h3 class="font-heading font-black text-cream text-2xl md:text-3xl uppercase tracking-[0.08em] mb-6">In and around {name}</h3>
        <div class="flex flex-wrap justify-center gap-3">
          {neighborhood_pills}
        </div>
        <p class="text-cream/60 text-sm mt-8 max-w-2xl mx-auto">Don't see your neighborhood? We serve every address in ZIP codes {zip_list}. Call <a href="tel:7704501744" class="text-orange hover:underline">(770) 450-1744</a> and we'll confirm same-day.</p>
      </div>
    </section>

    <!-- Services -->
    <section class="bg-cream py-16">
      <div class="max-w-5xl mx-auto px-4">
        <p class="text-orange uppercase tracking-[0.2em] font-bold text-sm mb-4">What we handle in {name}</p>
        <h3 class="font-heading font-black text-navy text-2xl md:text-3xl uppercase tracking-[0.08em] mb-8">Every service, one phone call.</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <a href="/wildlife/" class="block border border-navy/15 rounded-lg p-6 hover:border-orange hover:shadow-lg transition-all bg-white">
            <h4 class="font-heading font-bold text-navy uppercase tracking-[0.1em] text-lg mb-2">Wildlife Removal</h4>
            <p class="text-navy/70 text-sm">Trap, relocate and seal entry points — raccoons, squirrels, bats, beavers, snakes and everything else you don't want in your attic.</p>
          </a>
          <a href="/pest-control-services/" class="block border border-navy/15 rounded-lg p-6 hover:border-orange hover:shadow-lg transition-all bg-white">
            <h4 class="font-heading font-bold text-navy uppercase tracking-[0.1em] text-lg mb-2">Pest Control</h4>
            <p class="text-navy/70 text-sm">Termites, ants, roaches, spiders, mosquitoes and stinging insects. Recurring and one-time treatments.</p>
          </a>
          <a href="/commercial-services/" class="block border border-navy/15 rounded-lg p-6 hover:border-orange hover:shadow-lg transition-all bg-white">
            <h4 class="font-heading font-bold text-navy uppercase tracking-[0.1em] text-lg mb-2">Commercial Services</h4>
            <p class="text-navy/70 text-sm">Restaurants, offices, property management — discreet, scheduled and documented. We do the work after-hours when the business needs it.</p>
          </a>
          <a href="/warranty-assurance/" class="block border border-navy/15 rounded-lg p-6 hover:border-orange hover:shadow-lg transition-all bg-white">
            <h4 class="font-heading font-bold text-navy uppercase tracking-[0.1em] text-lg mb-2">Warranty Assurance</h4>
            <p class="text-navy/70 text-sm">Most wildlife exclusions carry a re-treat warranty. If something comes back, we come back.</p>
          </a>
        </div>
      </div>
    </section>

    <!-- Contact / Estimate -->
    <section id="contact" class="bg-navy py-16">
      <div class="max-w-7xl mx-auto px-4">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div class="text-cream">
            <h2 class="font-heading font-black text-3xl md:text-4xl uppercase tracking-[0.1em] mb-4">Get an estimate in {name}</h2>
            <p class="text-cream/70 mb-8">Same-day inspections are the norm. Fill the form or just pick up the phone — either way, someone on our team will be in touch within the hour during business days.</p>
            <div class="space-y-4">
              <div class="flex items-center gap-3">
                <img src="/assets/images/icons/clock.svg" alt="" class="w-6 h-6 invert">
                <span>24 hours a day, 6 days a week</span>
              </div>
              <div class="flex items-center gap-3">
                <img src="/assets/images/icons/speechbubble.svg" alt="" class="w-6 h-6 invert">
                <a href="tel:7704501744" class="hover:text-orange transition-colors">(770) 450-1744</a>
              </div>
              <div class="flex items-center gap-3">
                <img src="/assets/images/icons/email.svg" alt="" class="w-6 h-6 invert">
                <a href="mailto:info@removeasap.com" class="hover:text-orange transition-colors">info@removeasap.com</a>
              </div>
            </div>
            <img src="/assets/images/mascots/orange-mascot.svg" alt="" class="mt-8 w-24 opacity-80" loading="lazy">
          </div>
          <div>
            <form id="contact-form" class="space-y-4">
              <input type="hidden" name="client" value="asap-pest-wildlife">
              <input type="hidden" name="location" value="{name}, GA">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label for="firstName" class="block text-cream text-xs font-bold uppercase tracking-wider mb-1">FIRST Name*</label>
                  <input type="text" id="firstName" name="firstName" required class="w-full bg-transparent border border-cream/40 text-cream px-4 py-2.5 focus:border-orange outline-none transition text-sm">
                </div>
                <div>
                  <label for="lastName" class="block text-cream text-xs font-bold uppercase tracking-wider mb-1">LAST Name*</label>
                  <input type="text" id="lastName" name="lastName" required class="w-full bg-transparent border border-cream/40 text-cream px-4 py-2.5 focus:border-orange outline-none transition text-sm">
                </div>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label for="phone" class="block text-cream text-xs font-bold uppercase tracking-wider mb-1">Phone*</label>
                  <input type="tel" id="phone" name="phone" required class="w-full bg-transparent border border-cream/40 text-cream px-4 py-2.5 focus:border-orange outline-none transition text-sm">
                </div>
                <div>
                  <label for="email" class="block text-cream text-xs font-bold uppercase tracking-wider mb-1">Email*</label>
                  <input type="email" id="email" name="email" required class="w-full bg-transparent border border-cream/40 text-cream px-4 py-2.5 focus:border-orange outline-none transition text-sm">
                </div>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label for="city" class="block text-cream text-xs font-bold uppercase tracking-wider mb-1">City*</label>
                  <input type="text" id="city" name="city" required value="{name}" class="w-full bg-transparent border border-cream/40 text-cream px-4 py-2.5 focus:border-orange outline-none transition text-sm">
                </div>
                <div>
                  <label for="zip" class="block text-cream text-xs font-bold uppercase tracking-wider mb-1">Zip Code*</label>
                  <input type="text" id="zip" name="zip" required class="w-full bg-transparent border border-cream/40 text-cream px-4 py-2.5 focus:border-orange outline-none transition text-sm">
                </div>
              </div>
              <div>
                <label for="issue" class="block text-cream text-xs font-bold uppercase tracking-wider mb-1">I NEED PEACE WITH...*</label>
                <select id="issue" name="issue" required class="w-full bg-transparent border border-cream/40 text-cream px-4 py-2.5 focus:border-orange outline-none transition text-sm">
                  <option value="" class="bg-navy">Select one...</option>
                  <option value="Ant" class="bg-navy">Ant</option><option value="Armadillo" class="bg-navy">Armadillo</option><option value="Bat" class="bg-navy">Bat</option><option value="Beaver" class="bg-navy">Beaver</option><option value="Bee/Stinging Insect" class="bg-navy">Bee / Stinging Insect</option><option value="Coyote" class="bg-navy">Coyote</option><option value="Fox" class="bg-navy">Fox</option><option value="Mice" class="bg-navy">Mice</option><option value="Opossum" class="bg-navy">Opossum</option><option value="Raccoon" class="bg-navy">Raccoon</option><option value="Rat" class="bg-navy">Rat</option><option value="Snake" class="bg-navy">Snake</option><option value="Squirrel" class="bg-navy">Squirrel</option><option value="Termite" class="bg-navy">Termite</option><option value="Other" class="bg-navy">Other</option>
                </select>
              </div>
              <label class="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" name="smsConsent" class="mt-1 border-cream/40">
                <span class="text-xs text-cream/60">I agree to receive communications by text message about my inquiry. You may opt-out by replying STOP or reply HELP for more information. Message frequency varies. Message and data rates may apply.</span>
              </label>
              <button type="submit" class="w-full bg-navy border-2 border-cream text-cream font-bold uppercase tracking-[0.15em] py-3 hover:bg-cream hover:text-navy transition-colors text-sm">Submit</button>
              <div id="form-success" class="hidden mt-4 bg-green-900/50 border border-green-400/30 text-green-300 rounded p-4 text-center text-sm">Thank you! A member of our team will be in contact with you ASAP.</div>
              <div id="form-error" class="hidden mt-4 bg-red-900/50 border border-red-400/30 text-red-300 rounded p-4 text-center text-sm">Oops! Something went wrong. Please try again.</div>
            </form>
          </div>
        </div>
        <p class="text-xs text-cream/40 mt-8">Privacy Policy: 'No mobile information will be shared with third parties/affiliates for marketing/promotional purposes. All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties'</p>
      </div>
    </section>

    <!-- Other service areas -->
    <section class="bg-cream py-12">
      <div class="max-w-4xl mx-auto px-4 text-center">
        <p class="text-orange uppercase tracking-[0.2em] font-bold text-sm mb-4">Other service areas</p>
        <div class="flex flex-wrap justify-center gap-3">
          {other_area_pills}
        </div>
      </div>
    </section>
  </main>

  <script src="/assets/js/main.js"></script>
</body>
</html>
"""


def render(city: dict, all_cities: list[dict]) -> str:
    primary_zip = city["zips"][0]
    zip_list = ", ".join(city["zips"])

    # Additional areaServed entries for each ZIP
    zip_area_served = ""
    for z in city["zips"]:
        zip_area_served += f',\n          {{ "@type": "PostalCodeSpecification", "postalCode": "{z}", "addressCountry": "US" }}'

    neighborhood_pills = "\n          ".join(
        f'<span class="inline-block bg-cream/10 border border-cream/20 text-cream px-4 py-2 rounded-full text-sm">{n}</span>'
        for n in city["neighborhoods"]
    )

    other_area_pills = "\n          ".join(
        f'<a href="/locations/{c["slug"]}/" class="inline-block bg-navy/5 border border-navy/10 text-navy hover:bg-orange hover:text-white px-4 py-2 rounded-full text-sm uppercase tracking-wider font-bold transition-colors">{c["name"]}</a>'
        for c in all_cities
        if c["slug"] != city["slug"]
    )

    return PAGE_TEMPLATE.format(
        slug=city["slug"],
        name=city["name"],
        county=city["county"],
        meta_desc=city["meta_desc"],
        hero_sub=city["hero_sub"],
        intro=city["intro"],
        wildlife_para=city["wildlife_para"],
        pest_para=city["pest_para"],
        primary_zip=primary_zip,
        zip_list=zip_list,
        lat=city["lat"],
        lng=city["lng"],
        zip_area_served=zip_area_served,
        neighborhood_pills=neighborhood_pills,
        other_area_pills=other_area_pills,
    )


def build_index_page(cities: list[dict]) -> str:
    """The /locations/ hub page that lists all 5 cities."""
    card_html = "\n".join(
        textwrap.dedent(f"""\
          <a href="/locations/{c['slug']}/" class="group block bg-white border border-navy/15 rounded-lg p-6 hover:border-orange hover:shadow-lg transition-all">
            <p class="text-orange uppercase tracking-[0.2em] font-bold text-xs mb-2">{c['county']}</p>
            <h3 class="font-heading font-black text-navy uppercase tracking-[0.08em] text-xl group-hover:text-orange transition-colors">{c['name']}, GA</h3>
            <p class="text-navy/70 text-sm mt-3">{c['hero_sub']}</p>
            <p class="text-navy/40 text-xs mt-4 uppercase tracking-wider">ZIPs {', '.join(c['zips'])}</p>
          </a>""").strip()
        for c in cities
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Service Areas | ASAP Pest &amp; Wildlife Removal</title>
  <meta name="description" content="ASAP Pest & Wildlife Removal serves Metro Atlanta and North Georgia: Cartersville, Acworth, Kennesaw, Woodstock and Canton. Same-day inspections.">
  <link rel="canonical" href="https://removeasap.com/locations/">
  <link rel="icon" type="image/png" href="/assets/images/logos/favicon.png">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {{ theme: {{ extend: {{ colors: {{ navy: '#212936', orange: '#B77537', cream: '#F2EDDC', 'dark-text': '#222222' }}, fontFamily: {{ sans: ['urw-din','Arial','Helvetica Neue','Helvetica','sans-serif'], heading: ['urw-din','Arial','Helvetica Neue','Helvetica','sans-serif'] }} }} }} }};
  </script>
  <script src="https://use.typekit.net/dmg8gvn.js"></script>
  <script>try{{Typekit.load({{async:true}});}}catch(e){{}}</script>
  <link rel="stylesheet" href="/assets/css/style.css">
</head>
<body class="bg-cream text-dark-text font-sans">
  <div class="bg-navy text-cream text-sm">
    <div class="max-w-7xl mx-auto px-4 py-2 flex flex-wrap justify-between items-center">
      <a href="tel:7704501744" class="flex items-center gap-1 hover:text-orange transition-colors">
        <span class="uppercase tracking-wider text-xs font-bold">Call now: 770-450-1744</span>
      </a>
    </div>
  </div>
  <header class="bg-cream sticky top-0 z-50 border-b border-cream">
    <div class="max-w-7xl mx-auto px-4">
      <div class="flex items-center justify-between h-20">
        <a href="/" class="flex-shrink-0"><img src="/assets/images/logos/logo-orange-tagline.png" alt="ASAP Pest & Wildlife Removal" class="h-14 w-auto"></a>
        <nav class="hidden lg:flex items-center gap-8">
          <a href="/" class="text-navy font-bold text-sm uppercase tracking-[0.15em] hover:text-orange transition-colors">Home</a>
          <a href="/about/" class="text-navy font-bold text-sm uppercase tracking-[0.15em] hover:text-orange transition-colors">About</a>
          <a href="/wildlife/" class="text-navy font-bold text-sm uppercase tracking-[0.15em] hover:text-orange transition-colors">Wildlife</a>
          <a href="/pest-control-services/" class="text-navy font-bold text-sm uppercase tracking-[0.15em] hover:text-orange transition-colors">Pest Control</a>
          <a href="/commercial-services/" class="text-navy font-bold text-sm uppercase tracking-[0.15em] hover:text-orange transition-colors">Commercial</a>
          <a href="/services/" class="text-navy font-bold text-sm uppercase tracking-[0.15em] hover:text-orange transition-colors">Services</a>
          <a href="/blog/" class="text-navy font-bold text-sm uppercase tracking-[0.15em] hover:text-orange transition-colors">Blog</a>
        </nav>
      </div>
    </div>
  </header>
  <main>
    <section class="bg-navy py-16">
      <div class="max-w-7xl mx-auto px-4">
        <p class="text-orange uppercase tracking-[0.2em] font-bold text-sm mb-4">Where we work</p>
        <h1 class="font-heading font-black text-cream text-4xl md:text-6xl uppercase tracking-[0.05em]">Service Areas</h1>
        <p class="text-cream/70 mt-4 max-w-2xl">ASAP covers Metro Atlanta and the North Georgia corridor. Below are our most-requested service areas — and if you're outside them, call anyway. We say yes to most of North Georgia.</p>
      </div>
    </section>
    <section class="bg-cream py-16">
      <div class="max-w-6xl mx-auto px-4">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
{card_html}
        </div>
      </div>
    </section>
  </main>
  <script src="/assets/js/main.js"></script>
</body>
</html>
"""


def main() -> None:
    OUT_ROOT.mkdir(exist_ok=True)

    for city in CITIES:
        city_dir = OUT_ROOT / city["slug"]
        city_dir.mkdir(exist_ok=True)
        out = city_dir / "index.html"
        out.write_text(render(city, CITIES))
        print(f"  wrote {out.relative_to(ROOT)}")

    # Hub index
    hub = OUT_ROOT / "index.html"
    hub.write_text(build_index_page(CITIES))
    print(f"  wrote {hub.relative_to(ROOT)}")

    print(f"\nGenerated {len(CITIES)} city pages + 1 hub page.")


if __name__ == "__main__":
    main()
