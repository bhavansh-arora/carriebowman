#!/usr/bin/env python3
"""
Static-site builder for the Carrie Bowman site.

  _src/pages/*.html      page bodies, starting with  <!--meta {...json...} -->
  _src/partials/*.html   shared pieces, included with {{> name}}
  _src/testimonials.json client stories (rendered with the {{t...}} tags below)

Placeholders:
  {{> partial}}          include _src/partials/partial.html
  {{icon:name}}          inline SVG icon (see ICONS)
  {{page.key}}           a value from the page's meta block
  {{nav:key}}            aria-current="page" when the page's "nav" matches
  {{tcard:slug}}         compact testimonial card (headline, excerpt, person)
  {{tfull:slug}}         full testimonial card used on the Results page
  {{tslide:slug}}        large quote slide
  {{tface:slug}}         small round client photo

Run:  python3 _src/build.py   (writes the finished pages next to _src/)
"""
import hashlib
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "_src"
SITE_URL = "https://carriebowman.codebunny.net"

S = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'
ICONS = {
    "arrow": f'<svg {S}><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    "arrow-ur": f'<svg {S}><path d="M7 17 17 7M8 7h9v9"/></svg>',
    "arrow-left": f'<svg {S}><path d="M19 12H5M11 18l-6-6 6-6"/></svg>',
    "arrow-down": f'<svg {S}><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    "plus": f'<svg {S}><path d="M12 5v14M5 12h14"/></svg>',
    "check": f'<svg {S}><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    "x": f'<svg {S}><path d="M6 6l12 12M18 6 6 18"/></svg>',
    "mail": f'<svg {S}><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>',
    "pin": f'<svg {S}><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.6"/></svg>',
    "clock": f'<svg {S}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    "calendar": f'<svg {S}><rect x="3" y="4.5" width="18" height="17" rx="3"/><path d="M16 2.5v4M8 2.5v4M3 10h18"/></svg>',
    "video": f'<svg {S}><rect x="2.5" y="6" width="13" height="12" rx="3"/><path d="m15.5 10.5 6-3.5v10l-6-3.5"/></svg>',
    "users": f'<svg {S}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg>',
    "user": f'<svg {S}><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>',
    "chat": f'<svg {S}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.8A8 8 0 1 1 21 12z"/></svg>',
    "infinity": f'<svg {S}><path d="M18.2 8.2a5 5 0 1 1 0 7.6L12 12 5.8 8.2a5 5 0 1 0 0 7.6L12 12"/></svg>',
    "key": f'<svg {S}><circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M16 7l3 3M18.5 4.5l2 2"/></svg>',
    "lock": f'<svg {S}><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 1 1 8 0v3"/></svg>',
    "shield": f'<svg {S}><path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>',
    "play": f'<svg {S}><circle cx="12" cy="12" r="9.5"/><path d="m10 8.5 5.5 3.5-5.5 3.5z" fill="currentColor"/></svg>',
    "book": f'<svg {S}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>',
    "mic": f'<svg {S}><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v1a7 7 0 0 0 14 0v-1M12 18v4M8 22h8"/></svg>',
    "brain": f'<svg {S}><path d="M9.5 3A3.5 3.5 0 0 0 6 6.5v.2A3.5 3.5 0 0 0 4 13a3.5 3.5 0 0 0 3 4.9V18a3 3 0 0 0 5 2.2V4.2A3.5 3.5 0 0 0 9.5 3zM14.5 3A3.5 3.5 0 0 1 18 6.5v.2a3.5 3.5 0 0 1 2 6.3 3.5 3.5 0 0 1-3 4.9V18a3 3 0 0 1-5 2.2"/></svg>',
    "heart": f'<svg {S}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
    "body": f'<svg {S}><circle cx="12" cy="4.5" r="2.3"/><path d="M5 9l7 1.5L19 9M12 10.5v5M12 15.5 8.5 22M12 15.5l3.5 6.5"/></svg>',
    "compass": f'<svg {S}><circle cx="12" cy="12" r="9.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/></svg>',
    "target": f'<svg {S}><circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="1.5"/></svg>',
    "bolt": f'<svg {S}><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
    "route": f'<svg {S}><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H17a3.5 3.5 0 0 0 0-7H7a3.5 3.5 0 0 1 0-7h8.5"/></svg>',
    "eye": f'<svg {S}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    "leaf": f'<svg {S}><path d="M11 20A7 7 0 0 1 4 13c0-6 6-9 16-10-1 10-4 16-10 16"/><path d="M2 22c3-4 6-7 11-10"/></svg>',
    "spark": '<svg viewBox="0 0 40 40" fill="currentColor" aria-hidden="true"><path d="M20 2c1.2 11.6 6.4 16.8 18 18-11.6 1.2-16.8 6.4-18 18-1.2-11.6-6.4-16.8-18-18C13.6 18.8 18.8 13.6 20 2z"/></svg>',
    "sun": ('<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">'
            '<circle cx="20" cy="20" r="7.5" fill="currentColor" stroke="none"/>'
            '<path d="M20 3v5M20 32v5M3 20h5M32 20h5M8 8l3.5 3.5M28.5 28.5 32 32M8 32l3.5-3.5M28.5 11.5 32 8"/></svg>'),
    "quote": '<svg viewBox="0 0 48 36" fill="currentColor" aria-hidden="true"><path d="M0 36V20.6C0 9.7 5.7 2.8 17.1 0l2.4 4.6C13.4 6.7 10.4 10.6 10.2 16H19v20zm28.6 0V20.6C28.6 9.7 34.3 2.8 45.6 0L48 4.6c-6.1 2.1-9.1 6-9.3 11.4h8.8v20z"/></svg>',
    "linkedin": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3zM9.5 9.5h3.8v1.6h.06c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.77 2.65 4.77 6.1V21h-4v-5.1c0-1.22-.02-2.79-1.7-2.79-1.7 0-1.96 1.33-1.96 2.7V21h-4z"/></svg>',
    "instagram": f'<svg {S}><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/></svg>',
    "facebook": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21z"/></svg>',
    "youtube": '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3z"/></svg>',
}

# Brand mark: a sun rising over the horizon
MARK = ('<svg class="brand__mark" viewBox="0 0 40 40" aria-hidden="true">'
        '<circle cx="20" cy="20" r="19" fill="none" stroke="currentColor" stroke-width="1.4"/>'
        '<path d="M9 24a11 11 0 0 1 22 0z" fill="var(--sun)"/>'
        '<path d="M6 24h28M10.5 28.5h19M15 32.6h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>')

TAG_LABEL = {
    "sm": "Self-Mastery™", "private": "Private coaching", "career": "Career & direction",
    "anxiety": "Anxiety & overwhelm", "purpose": "Purpose & fulfilment", "confidence": "Confidence & self-worth",
    "recovery": "Recovery",
}

TESTIMONIALS = {t["slug"]: t for t in json.loads((SRC / "testimonials.json").read_text(encoding="utf-8"))}


def esc(s):
    return html.escape(s, quote=False)


def face(t, cls="face"):
    return (f'<img class="{cls}" src="assets/img/clients/{t["slug"]}.webp" alt="" width="140" height="140" '
            f'loading="lazy" decoding="async">')


def person(t):
    return (f'<div class="person">{face(t)}<div><b>{esc(t["name"])}</b>'
            f'<span>{esc(t["program"])}</span></div></div>')


def tcard(slug):
    t = TESTIMONIALS[slug]
    return (f'<figure class="tcard"><span class="tcard__mark">{ICONS["quote"]}</span>'
            f'<blockquote><p class="tcard__head">{esc(t["head"])}</p><p>{esc(t["body"][0])}</p></blockquote>'
            f'<figcaption>{person(t)}</figcaption></figure>')


def tfull(slug):
    t = TESTIMONIALS[slug]
    tags = " ".join(t["tags"])
    chips = "".join(f'<span>{TAG_LABEL[g]}</span>' for g in t["tags"])
    body = "".join(f"<p>{esc(p)}</p>" for p in t["body"])
    more = len(" ".join(t["body"])) > 420
    return (f'<article class="story{" is-long" if more else ""}" data-cat="{tags}" data-reveal>'
            f'<div class="story__top">{person(t)}<span class="story__mark">{ICONS["quote"]}</span></div>'
            f'<h3 class="story__head">{esc(t["head"])}</h3>'
            f'<div class="story__body">{body}</div>'
            + ('<button class="story__more" type="button" aria-expanded="false"><span>Read the full story</span>'
               f'{ICONS["plus"]}</button>' if more else '')
            + f'<div class="story__tags">{chips}</div></article>')


def tslide(slug):
    t = TESTIMONIALS[slug]
    return (f'<figure class="qslide"><blockquote>{esc(t["pull"])}</blockquote>'
            f'<figcaption>{person(t)}</figcaption></figure>')


def render(text, meta, depth=0):
    if depth > 8:
        raise RuntimeError("include depth exceeded")

    def inc(m):
        name = m.group(1).strip()
        return render((SRC / "partials" / f"{name}.html").read_text(encoding="utf-8"), meta, depth + 1)

    text = re.sub(r"\{\{>\s*([\w-]+)\s*\}\}", inc, text)
    text = re.sub(r"\{\{tcard:([\w-]+)\}\}", lambda m: tcard(m.group(1)), text)
    text = re.sub(r"\{\{tfull:([\w-]+)\}\}", lambda m: tfull(m.group(1)), text)
    text = re.sub(r"\{\{tslide:([\w-]+)\}\}", lambda m: tslide(m.group(1)), text)
    text = re.sub(r"\{\{tface:([\w-]+)\}\}", lambda m: face(TESTIMONIALS[m.group(1)], "face face--stack"), text)
    text = re.sub(r"\{\{icon:([\w-]+)\}\}", lambda m: ICONS[m.group(1)], text)
    text = text.replace("{{mark}}", MARK)
    text = text.replace("{{count:stories}}", str(len(TESTIMONIALS)))
    text = re.sub(r"\{\{nav:([\w-]+)\}\}",
                  lambda m: 'aria-current="page"' if meta.get("nav") == m.group(1) else "", text)
    text = re.sub(r"\{\{page\.([\w-]+)\}\}", lambda m: str(meta.get(m.group(1), "")), text)
    return text


def bust_cache(page_html):
    """Append ?v=<content hash> to local CSS/JS so browsers fetch fresh files after each change."""
    def ver(m):
        path = m.group(2)
        f = ROOT / path
        if not f.is_file():
            return m.group(0)
        h = hashlib.md5(f.read_bytes()).hexdigest()[:8]
        return f'{m.group(1)}{path}?v={h}"'

    return re.sub(r'((?:href|src)=")(assets/(?:css|js|vendor)/[\w.-]+\.(?:css|js))"', ver, page_html)


def build():
    layout = (SRC / "partials" / "layout.html").read_text(encoding="utf-8")
    for page in sorted((SRC / "pages").glob("*.html")):
        raw = page.read_text(encoding="utf-8")
        m = re.match(r"\s*<!--meta\s*(\{.*?\})\s*-->", raw, re.S)
        meta = json.loads(m.group(1)) if m else {}
        body = raw[m.end():] if m else raw
        meta.setdefault("slug", page.name)
        meta["canonical"] = SITE_URL + "/" + ("" if page.name == "index.html" else page.name)
        meta.setdefault("og_image", "assets/img/og-carrie-bowman.jpg")
        meta.setdefault("htmlclass", "" if page.name == "index.html" else "no-preloader")
        meta.setdefault("head", "")   # extra <head> tags for one page, e.g. a hero image preload
        html_out = render(layout, meta).replace("{{BODY}}", render(body, meta))
        html_out = bust_cache(html_out)
        leftover = re.findall(r"\{\{[^}]*\}\}", html_out)
        if leftover:
            raise SystemExit(f"{page.name}: unresolved placeholders {leftover[:5]}")
        (ROOT / page.name).write_text(html_out, encoding="utf-8")
        print("built", page.name)


if __name__ == "__main__":
    build()
