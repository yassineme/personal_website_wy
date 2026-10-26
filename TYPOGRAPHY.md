# Identity, scroll treatment and typography proposals

The public website's top-left identity is now the symbol alone. The home link keeps the accessible name “Yassine W. Medjati — home”. Author names and article attribution remain in their content locations.

## Scroll veil

`site-ui.css` and `site-ui.js` provide a fixed, pointer-transparent blur at the top of each public page. Opacity follows the first 80 pixels of scroll, starting at zero. The treatment uses a soft vertical mask, with a 12 px backdrop blur on desktop and 10 px on phone layouts. It clears at the top and while an expandable menu preview is open. Reading progress remains above the veil. The effect respects reduced-motion preferences and is omitted from print.

The article publishing template includes these assets so future articles inherit the treatment and the symbol-only identity.

## Selected typography

**Instrument Sans + Newsreader** is the selected and implemented direction. Instrument Sans 600 is used for primary headings; navigation and labels use 500–600. Newsreader 400 provides the article reading face at 20–21 px, with 500 italic for selected accents. The default is set in HTML for immediate rendering and in the article publishing template for future posts. The primary sans font is preloaded locally.

Two alternatives remain available for reference: **Manrope + Newsreader**, and **Sora + Source Serif 4**.

The proposals use the same hierarchy and content, allowing the typeface differences to be compared directly. Primary headings use the sans family; articles use the serif for continuous reading. The proposals use fewer italic passages, larger reading text, and a clearer distinction between heading, paragraph and label weights.

## Review

Open `typography-preview.html` to compare the three directions and switch its live website preview between the homepage, blog and article. The page is marked `noindex,nofollow` and is not included in the sitemap or public navigation.

To review a pairing on a public page, append one of these query parameters:

- `?font=manrope-newsreader`
- `?font=instrument-newsreader`
- `?font=sora-source-serif`

The proposal is carried through internal HTML navigation while reviewing. It is not stored and does not change the canonical page URLs. Normal public URLs use Instrument Sans + Newsreader, including when JavaScript is disabled.

## Fonts and sources

All font files are local WOFF2 assets in `assets/fonts/`. The comparison uses Latin subsets supplied by Google Fonts. Each family's license text is included there.

- Manrope: https://fonts.google.com/specimen/Manrope
- Newsreader: https://productiontype.com/font/newsreader
- Instrument Sans: https://github.com/Instrument/instrument-sans
- Sora: https://github.com/sora-xor/sora-font
- Source Serif 4: https://github.com/adobe-fonts/source-serif

## Verification

Browser checks cover the symbol-only identity, default typography, all three font proposals at 320 px, the comparison controls, local font loading, progressive blur on desktop and phone, and continued access to menu and blog controls. Static checks cover links, fragments, ARIA references, JSON-LD, local font file signatures and publisher syntax.
