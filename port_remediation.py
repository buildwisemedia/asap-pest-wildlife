#!/usr/bin/env python3
"""Port the 7/7 remediation branch's still-missing fixes onto today's main.

Element-level porting — never wholesale file copies. Classes:
  A global text replacements (dead domain, brand, typos)
  B LocalBusiness schema (reviewCount 547 + areaServed counties)
  C FAQ/Speakable JSON-LD injection from branch pages
  D geo <title> port (only where main still equals the pre-branch title)
  E single-H1 (demote extras exactly as branch did)
  F canonical/meta-description injection where branch added + main lacks
  J img alt additions from branch where main still lacks
  H/I report-only: bwm-analytics.js diff, form-label coverage

Run: python3 port_remediation.py [--apply]   (default = dry-run report)
"""
import re, subprocess, sys, pathlib, json

BRANCH = "418a599"          # branch tip
BASE = "9d9f0a1"            # set at runtime if needed; parent of 58cb5ae fetched below
APPLY = "--apply" in sys.argv
root = pathlib.Path(".")

def sh(args):
    return subprocess.run(args, capture_output=True, text=True).stdout

def branch_file(path):
    r = subprocess.run(["git", "show", f"{BRANCH}:{path}"], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else None

def base_file(path):
    r = subprocess.run(["git", "show", f"{BRANCH}~3:{path}"], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else None

pages = sorted(str(p) for p in root.glob("**/index.html") if ".git" not in str(p))
pages = [p.lstrip("./") for p in pages]
report = {}

# ---------- A: global replacements ----------
REPL = [
    ("wildliferemovalasap.com", "removeasap.com"),
    ("ASAP Wildlife Removal", "ASAP Pest & Wildlife Removal"),
    ("Reocurring", "Recurring"),
    ("Lanscapers", "Landscapers"),
]
WORD_REPL = [(r"\btress\b", "trees"), (r"\bTress\b", "Trees")]
a_counts = {}
for p in pages + ["llms.txt", "llms-full.txt"]:
    f = root / p
    if not f.exists():
        continue
    t = f.read_text()
    n = 0
    for old, new in REPL:
        n += t.count(old)
        t = t.replace(old, new)
    for pat, new in WORD_REPL:
        n += len(re.findall(pat, t))
        t = re.sub(pat, new, t)
    if n:
        a_counts[p] = n
        if APPLY:
            f.write_text(t)
report["A_text_replacements"] = {"files": len(a_counts), "total": sum(a_counts.values())}

# ---------- B: LocalBusiness schema ----------
b_done = []
OLD_AREA = re.compile(r'"areaServed":\s*\{\s*"@type":\s*"City",\s*"name":\s*"Atlanta"\s*\}', re.S)
NEW_AREA = ('"areaServed": [\n      {"@type": "City", "name": "Atlanta"},\n'
            '      {"@type": "AdministrativeArea", "name": "Cherokee County"},\n'
            '      {"@type": "AdministrativeArea", "name": "Cobb County"},\n'
            '      {"@type": "AdministrativeArea", "name": "DeKalb County"},\n'
            '      {"@type": "AdministrativeArea", "name": "Fayette County"},\n'
            '      {"@type": "AdministrativeArea", "name": "Forsyth County"},\n'
            '      {"@type": "AdministrativeArea", "name": "Fulton County"},\n'
            '      {"@type": "AdministrativeArea", "name": "Gwinnett County"}\n    ]')
for p in pages:
    f = root / p
    t = f.read_text()
    changed = False
    if '"reviewCount": "100"' in t:
        t = t.replace('"reviewCount": "100"', '"reviewCount": "547"'); changed = True
    if OLD_AREA.search(t):
        t = OLD_AREA.sub(NEW_AREA, t); changed = True
    if changed:
        b_done.append(p)
        if APPLY:
            f.write_text(t)
report["B_schema"] = b_done

# ---------- C: FAQ/Speakable JSON-LD ----------
LD = re.compile(r'<script type="application/ld\+json">.*?</script>', re.S)
c_done = []
for p in pages:
    bt = branch_file(p)
    if not bt:
        continue
    want = [b for b in LD.findall(bt) if '"FAQPage"' in b or '"speakable"' in b.lower()]
    if not want:
        continue
    f = root / p
    t = f.read_text()
    add = [b for b in want if ('"FAQPage"' in b and '"FAQPage"' not in t) or ('speakable' in b.lower() and 'speakable' not in t.lower())]
    if add and "</head>" in t:
        t = t.replace("</head>", "\n".join(add) + "\n</head>", 1)
        c_done.append((p, len(add)))
        if APPLY:
            f.write_text(t)
report["C_faq_speakable"] = c_done

# ---------- D: titles ----------
TITLE = re.compile(r"<title>(.*?)</title>", re.S)
d_done, d_skipped = [], []
for p in pages:
    bt, ot = branch_file(p), base_file(p)
    if not bt or not ot:
        continue
    mb, mo = TITLE.search(bt), TITLE.search(ot)
    f = root / p
    t = f.read_text()
    mm = TITLE.search(t)
    if not (mb and mo and mm):
        continue
    if mb.group(1) != mo.group(1):          # branch changed this title
        if mm.group(1) == mo.group(1):      # main still has the old one -> port
            t = t.replace(f"<title>{mm.group(1)}</title>", f"<title>{mb.group(1)}</title>", 1)
            d_done.append(p)
            if APPLY:
                f.write_text(t)
        elif mm.group(1) != mb.group(1):    # main diverged independently -> skip, report
            d_skipped.append(p)
report["D_titles"] = {"ported": len(d_done), "diverged_skipped": d_skipped}

# ---------- E: single-H1 ----------
H1_OPEN = re.compile(r"<h1(\s[^>]*)?>", re.I)
e_done, e_flag = [], []
for p in pages:
    f = root / p
    t = f.read_text()
    if len(H1_OPEN.findall(t)) <= 1:
        continue
    bt = branch_file(p)
    if not bt or len(H1_OPEN.findall(bt)) != 1:
        e_flag.append(p); continue
    # find h1 blocks in main; demote any whose inner text does not appear as branch's h1
    bmatch = re.search(r"<h1(?:\s[^>]*)?>(.*?)</h1>", bt, re.S)
    keep_text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", bmatch.group(1))).strip() if bmatch else None
    def demote(m):
        inner_text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", m.group(2))).strip()
        if keep_text and inner_text == keep_text:
            return m.group(0)
        attrs = m.group(1) or ""
        return f"<div{attrs}>{m.group(2)}</div>"
    new = re.sub(r"<h1(\s[^>]*)?>(.*?)</h1>", demote, t, flags=re.S)
    if len(H1_OPEN.findall(new)) == 1:
        e_done.append(p)
        if APPLY:
            f.write_text(new)
    else:
        e_flag.append(p)
report["E_single_h1"] = {"fixed": e_done, "needs_manual": e_flag}

# ---------- F: canonical + meta description ----------
f_done = []
for p in pages:
    bt, ot = branch_file(p), base_file(p)
    if not bt or not ot:
        continue
    f = root / p
    t = f.read_text()
    adds = []
    for pat in (r'<link rel="canonical"[^>]*>', r'<meta name="description"[^>]*>'):
        b_has, o_has, m_has = re.search(pat, bt), re.search(pat, ot), re.search(pat, t)
        if b_has and not o_has and not m_has:
            adds.append(b_has.group(0))
    if adds and "</head>" in t:
        t = t.replace("</head>", "\n".join(adds) + "\n</head>", 1)
        f_done.append((p, len(adds)))
        if APPLY:
            f.write_text(t)
report["F_canonical_meta"] = f_done

# ---------- G: files ----------
g = {}
# sitemap /book
sm = root / "sitemap.xml"
t = sm.read_text()
if "/book" in t:
    new = re.sub(r"\s*<url>(?:(?!</url>).)*?/book(?:(?!</url>).)*?</url>", "", t, flags=re.S)
    g["sitemap_book_removed"] = new != t
    if APPLY and new != t:
        sm.write_text(new)
# _headers CSP
bh = branch_file("_headers")
hf = root / "_headers"
cur = hf.read_text() if hf.exists() else ""
if bh and "Content-Security-Policy" in bh and "Content-Security-Policy" not in cur:
    csp = [l for l in bh.splitlines() if "Content-Security-Policy" in l]
    block = "\n/*\n" + "\n".join("  " + c.strip() for c in csp) + "\n"
    g["csp_added"] = True
    if APPLY:
        hf.write_text(cur.rstrip() + "\n" + block if cur else "/*\n" + "\n".join("  " + c.strip() for c in csp) + "\n")
else:
    g["csp_added"] = False
    g["csp_note"] = "branch has none or main already has CSP"
# _redirects www rule
br = branch_file("_redirects")
rf = root / "_redirects"
rcur = rf.read_text() if rf.exists() else ""
if br:
    missing = [l for l in br.splitlines() if l.strip() and l not in rcur]
    g["redirects_lines_added"] = missing
    if APPLY and missing:
        rf.write_text(rcur.rstrip() + "\n" + "\n".join(missing) + "\n")
report["G_files"] = g

# ---------- H/I: report-only ----------
report["H_analytics_diff_lines"] = len(sh(["git", "diff", f"{BRANCH}~3", BRANCH, "--", "assets/js/bwm-analytics.js"]).splitlines())
report["H_analytics_main_vs_branch"] = len(sh(["git", "diff", "HEAD", BRANCH, "--", "assets/js/bwm-analytics.js"]).splitlines())
report["I_forms_note"] = "v8.9 rewrote form markup; branch label fixes target old markup — verify label coverage separately"

print(json.dumps(report, indent=1)[:4000])
print("MODE:", "APPLIED" if APPLY else "DRY-RUN")
