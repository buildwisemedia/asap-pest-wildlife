# ASAP City-Page Hero Heading Variants

All three directions preserve the exact H1 text, the existing ASAP palette and typography, and every other hero element. Replace `Canton` with the sibling page city when propagating a selected treatment.

## A — Balanced Scale

Rationale: Reduces the all-caps headline from a five-line takeover to a calmer, balanced block while preserving the current one-level hierarchy.

Markup change: none. Keep the original H1 exactly as written.

```html
<h1 class="hero-h1 text-color---burnt-orange outlined-orange">Wildlife Removal in Canton, GA</h1>
```

Exact style block:

```html
<style id="hero-variant">
/* Heading A — Balanced Scale */
.section-2 .hero-h1 {
  max-width: 10ch;
  margin: 0;
  font-size: clamp(3.35rem, 5.3vw, 5.25rem);
  line-height: .88;
  letter-spacing: -.035em;
  text-wrap: balance;
}
</style>
```

## B — Location Badge

Rationale: Keeps the service dominant, then turns the city into a compact orange-and-navy locator badge for faster scanning.

Exact markup change:

```html
<h1 class="hero-h1 text-color---burnt-orange outlined-orange"><span class="hero-heading-service">Wildlife Removal</span> <span class="hero-heading-place">in Canton, GA</span></h1>
```

Exact style block:

```html
<style id="hero-variant">
/* Heading B — Location Badge */
.section-2 .hero-h1 {
  max-width: 11ch;
  margin: 0;
  font-size: clamp(3.35rem, 5.2vw, 5rem);
  line-height: .9;
  letter-spacing: -.035em;
}

.section-2 .hero-heading-service,
.section-2 .hero-heading-place {
  display: block;
}

.section-2 .hero-heading-place {
  width: fit-content;
  max-width: 100%;
  margin-top: .3em;
  padding: .16em .3em .2em;
  border-radius: 5px 20px;
  background: var(--burnt-orange);
  color: var(--navy);
  font-size: .58em;
  line-height: 1;
  letter-spacing: -.015em;
  text-shadow: none;
  -webkit-text-stroke: 0;
}
</style>
```

## C — Locality Lead

Rationale: Reverses the emphasis so the city is the visual anchor, with the service acting as a compact overline and orange rule.

Exact markup change:

```html
<h1 class="hero-h1 text-color---burnt-orange outlined-orange"><span class="hero-heading-service">Wildlife Removal in</span> <span class="hero-heading-place">Canton, GA</span></h1>
```

Exact style block:

```html
<style id="hero-variant">
/* Heading C — Locality Lead */
.section-2 .hero-h1 {
  max-width: 100%;
  margin: 0;
  font-size: clamp(2.75rem, 4.8vw, 4.5rem);
  line-height: .88;
  letter-spacing: -.05em;
}

.section-2 .hero-heading-service {
  display: flex;
  align-items: center;
  gap: .55em;
  color: var(--navy);
  font-size: .38em;
  line-height: 1.15;
  letter-spacing: .12em;
  text-shadow: none;
  -webkit-text-stroke: 0;
}

.section-2 .hero-heading-service::after {
  content: "";
  flex: 1 1 4rem;
  height: 3px;
  background: var(--burnt-orange);
}

.section-2 .hero-heading-place {
  display: block;
  margin-top: .16em;
  color: var(--burnt-orange);
  font-size: 1em;
  line-height: .88;
  letter-spacing: -.055em;
}
</style>
```
