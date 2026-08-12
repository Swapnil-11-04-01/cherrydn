# CHERRY DN — Underwater Fire

An immersive one-page site for multidisciplinary artist **Cherry DN** —
poetry, music, photography, film, shop. Dark, feminine, cinematic, ethereal, editorial.

The page is **scroll-choreographed**: sections don't just sit there — elements
flow in as you approach them (sliding, rising, scaling) and drift out as you
leave, the hero sinks away behind you, the book opens as you reach it, glyphs
and photographs move at different depths, and the whole sea darkens the deeper
you scroll. Scrolling back up reverses everything.

## The two templates

The site has two locked forms, chosen on **`settings.html`** (also reachable
via the small "✦ templates" link in the footer):

| Template | Form |
|---|---|
| **1 · The Descent** (default) | one flowing page; everything moves with the scroll |
| **2 · The Stages** | a deck of 13 full-screen scenes; wheel/swipe dissolves between them, each poetry element is its own act, the sea re-tints per element, the book leans toward the cursor |

The choice is saved in the browser (`cdn-template`); `index.html` opens as
whichever template is selected. Both templates share the same content, moods,
and curator uploads. Template 2 lives in `template2.html` + `css/style2.css` +
`js/main2.js` and never touches Template 1's files.

## The two moods

The button in the top-right corner switches the whole site between the two
palettes Cherry described, live:

| Mood | Palette |
|---|---|
| **Underwater Fire** (default) | deep cherry red + water blue on deep-sea black |
| **Cherry Noir** | cherry / black / white |

The visitor's choice is remembered. To change the *default*, edit the
`data-theme="fire"` attribute on the `<html>` tag in `index.html`.

## Curator mode — how Cherry decorates the site herself

Open the site with **`?curate`** at the end of the URL
(e.g. `http://localhost:8123/?curate`). The page becomes editable:

- **Every art pane** (portrait, the four photography panes, both film stills,
  the three shop panes, even the book cover) gets an **artwork / reset** chip —
  click, choose a file, done. Film stills also accept **video clips**.
- **＋ add a piece** in the Photography grid lets her add unlimited artworks,
  each with its own caption.
- **All the words are editable** — poems, verses, bios, titles, prices,
  captions. Click any outlined text and type.
- **Music**: in curator mode, clicking a track's play circle uploads an audio
  file; outside curator mode that circle then really plays her song.
- **The gift page** (`gift.html?curate`) accepts the audiobook upload.
- Click **done** (bottom bar) to leave curator mode.

Everything she uploads or edits is stored **in her own browser**
(IndexedDB + localStorage) — no server, no account. It lives on that
device/browser; when the site gets real hosting, the same slots map 1:1 onto
real files or a CMS.

The `✦ curate` button only appears when the URL has `?curate` — ordinary
visitors can never stumble into edit mode.

## The QR audiobook gift

`gift.html` is the page her printed book's QR code will point to
("you found the ember key"). It plays the audiobook once she uploads it.
When the domain is live, generate a QR for `https://her-domain/gift.html`
with any QR generator and replace the decorative QR SVG in `index.html`.

## Files

```
index.html      — Template 1 (The Descent): content + long-page choreography
template2.html  — Template 2 (The Stages): the full-screen scene deck
settings.html   — template picker (saved per browser)
gift.html       — the hidden audiobook-gift page (QR destination)
css/style.css   — Template 1 styling      js/main.js  — Template 1 engine
css/style2.css  — Template 2 styling      js/main2.js — Template 2 engine
_archive/       — an earlier multi-page experiment, kept for reference
```

## Placeholders to confirm with Cherry

- Book title (currently *Underwater Fire* — borrowed from her own palette phrase)
- Track names, lengths, streaming URLs (Spotify/Apple/YouTube/Bandcamp links)
- Prices in the Shop
- Social links, contact email (`hello@cherrydn.art` is a placeholder)
- Her portrait, photography, film stills — via curator mode

## Running locally

```
python3 -m http.server 8123
```

No build step, no dependencies — plain HTML/CSS/JS, hostable anywhere
(Netlify, Vercel, GitHub Pages) or handed to any developer.
