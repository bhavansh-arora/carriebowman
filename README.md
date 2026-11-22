# Carrie Bowman: Master Life Coach & Trained Therapist

A multi-page static website concept for Carrie Bowman, MA, PCC, CLC (Dallas and online). It needs no framework and runs on any static host: GitHub Pages, Netlify, Vercel, cPanel, or a custom-code embed. Content, photos and client stories come from carriebowman.com.

## Pages
| Page | File |
| --- | --- |
| Home (hero, Quiet the Noise, method, Self-Mastery™ dial, Readiness Check, results wall, story, free guide) | `index.html` |
| Self-Mastery™: who it’s for, why it’s different, weekly rhythm, 12-week arc, what’s included, comparison, FAQ | `self-mastery.html` |
| Limitless Mastery: private coaching, on-demand support, program comparison | `limitless-mastery.html` |
| About Carrie: story timeline, credentials, “10 glimpses” flip cards | `about.html` |
| Client results: all 34 stories, filterable | `results.html` |
| Speaking: topics, formats, booking form | `speaking.html` |
| Journal and the “5 Bold Steps” guide | `journal.html` |
| Request a Clarity Call: 4-step intake, then Carrie’s Acuity calendar pre-filled | `clarity-call.html` |
| Not found | `404.html` |

## Editing
The pages in this folder are **generated**. Edit the source, then rebuild:

```bash
python3 _src/build.py
```

- `_src/pages/*.html`: the body of each page (the meta block at the top sets title, description and active nav item)
- `_src/partials/*.html`: shared header, menu, footer, final call-to-action, Readiness Check quiz, free-guide band
- `_src/testimonials.json`: all client stories. Pages place them with `{{tcard:slug}}`, `{{tfull:slug}}`, `{{tslide:slug}}` or `{{tface:slug}}`
- `assets/css/main.css`: design tokens (colour, type, spacing) at the top, then components, then responsive rules
- `assets/js/site.js`: menu, header, cursor, page transitions, Readiness Check, Clarity Call intake, filters, forms
- `assets/js/motion.js`: GSAP + ScrollTrigger animations (switched off for people who prefer reduced motion)

## Connecting the automations
Everything is in **`assets/js/config.js`**:

- `bookingUrl`: Carrie’s Acuity scheduler. After the intake, “Choose your time” opens it with name, email and phone filled in.
- `intakeEndpoint`, `speakingEndpoint`, `guideEndpoint`, `insiderEndpoint`: any URL that accepts a JSON POST (Zapier or Make webhook, Formspree, ActiveCampaign via webhook …). While they’re empty, each form opens a pre-filled email to Carrie instead.
- `speakingReply`: the response time shown after a speaking enquiry.

## Deploying
The folder is self-contained and uses only relative links, so it works at a sub-path or on its own domain. `CNAME` is set to `carriebowman.codebunny.net` for when it moves into its own repository on GitHub Pages.

## Preview locally
```bash
python3 -m http.server 8080
```
Then open http://localhost:8080 from inside this folder.
