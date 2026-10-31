# Argus Panoptes — local photography portfolio

The photography page uses all nine photographs supplied in `/Users/yassine/Documents/personal_website/pexels`. Originals are unchanged. Web copies in `assets/photography/pexels/` have a maximum dimension of 2000 pixels, preserving aspect ratios. The existing public build automatically includes these asset files; the original `pexels` folder stays outside the generated public tree.

`photography-data.js` defines display order, image URLs, accessible descriptions, captions, source and photographer credits. Credits are based on the supplied filenames; credit links use their Pexels photo IDs. These remain explicitly labelled dummy photographs, and the page remains noindex/nofollow.

`photography.css` defines a compact nine-photo composition with separate mobile arrangements. The name is fixed with its h1 midpoint at the viewport center. Front photos use z-index 5, the name uses 3 and rear photos use 2; their ancestors must not create isolated stacking contexts. A passive scroll listener updates two CSS variables for subtle differential travel and a masked top-edge backdrop blur. Reduced-motion disables the additional parallax. The full image viewer automatically navigates all entries and preserves uncropped photographs, curved side previews, motion blur, buttons, arrow keys, Escape, drag/swipe and scroll navigation.

## Cloudinary replacement

Replace the `src` values in `photography-data.js` with public Cloudinary delivery URLs and update alt text, captions and credits. No API key or secret is needed in the browser. The current composition supports nine entries; add corresponding CSS positions and extend the gallery height if more are added. When replacing dummy images with original work, update the dummy-photo wording in photography.html and review noindex and the sitemap configuration.

## Footer doorway

The main homepage's discreet aperture link loads `photography-portal.css` and `photography-portal.js`. Clicking it opens a circular photo reveal; the homepage recedes, and the photograph settles into the gallery after navigation. It always uses the first entry in photography-data.js. Escape/Cancel stops departure, browser Back restores the homepage, and reduced-motion visitors use an ordinary link. The temporary arrival hash is removed immediately. No storage, analytics events or external services are added. Normal new-tab behavior and navigation without JavaScript are preserved.

## Local preview

Run `python3 scripts/preview-photography.py` from this review folder. Open http://127.0.0.1:8768/ for the homepage or http://127.0.0.1:8768/photography.html for the gallery. The review server falls back to the current checkout's generated public files. API routes are not implemented by this static preview.

Everything remains local. Nothing is committed, pushed or published.

## Identity

The photography identity is Argus Panoptes. The page title, metadata, main heading, aperture mark and portfolio introduction use the alias; the professional homepage retains its existing identity. The footer doorway and transition introduce Argus Panoptes. The portfolio copy presents a selection from a wider body of work, while placeholder disclosures and individual Pexels credits remain accurate until original photography replaces them.
