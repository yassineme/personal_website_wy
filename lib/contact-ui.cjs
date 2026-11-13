'use strict';
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg>';

function contactPage({message='', unavailable=false, token='', success=false, preview=false, values={}}={}) {
  const title = success ? (preview ? 'Preview request saved' : 'Request received') : 'Send an enquiry';
  const heading = success ? (preview ? 'Saved for<br><em>preview.</em>' : 'Message<br><em>received.</em>') : unavailable ? 'A brief<br><em>pause.</em>' : 'Let’s talk<br><em>about it.</em>';
  const intro = success
    ? (preview ? 'Your request is saved in the local preview outbox for this server session. No email has been sent.' : 'Thank you for reaching out. I’ll review your message and reply to you personally by email.')
    : unavailable ? 'The enquiry form is taking a moment. You can still reach me directly by email.' : 'A question, a challenge, or an idea you want to explore. Tell me a little about it.';
  const form = `<form method="post" action="/contact" aria-labelledby="enquiry-title">
    <input type="hidden" name="action" value="request"><input type="hidden" name="kind" value="enquiry"><input type="hidden" name="request_token" value="${escape(token)}">
    <div class="contact-trap" aria-hidden="true"><label for="contact-website">Website</label><input id="contact-website" name="website" tabindex="-1" autocomplete="off"></div>
    <div class="contact-field"><label for="contact-name"><span class="field-number" aria-hidden="true">01</span>Your name</label><input id="contact-name" name="name" autocomplete="name" placeholder="How should I address you?" required maxlength="80" value="${escape(values.name)}"></div>
    <div class="contact-field"><label for="contact-email"><span class="field-number" aria-hidden="true">02</span>Email address</label><input id="contact-email" name="email" type="email" autocomplete="email" placeholder="Where can I reach you?" required maxlength="254" value="${escape(values.email)}"></div>
    <div class="contact-field"><label for="contact-message"><span class="field-number" aria-hidden="true">03</span>What’s on your mind?</label><textarea id="contact-message" name="message" rows="4" maxlength="1000" required aria-describedby="message-limit" placeholder="A little context goes a long way…">${escape(values.message)}</textarea><p id="message-limit" class="field-hint">Up to 1,000 characters</p></div>
    <div class="contact-submit"><button type="submit"><span>Send enquiry</span>${arrow}</button><p class="contact-privacy">Your details are used to respond to this enquiry. You’ll receive an email acknowledgement. <a href="/privacy">Privacy information</a></p></div>
  </form>`;
  const state = success
    ? `<div class="contact-confirmation"><span class="confirmation-mark" aria-hidden="true">↗</span><h2 id="enquiry-title">${preview ? 'Ready for your review.' : 'Thank you for the conversation starter.'}</h2><p>${preview ? 'This is a local preview. Restarting the server clears its preview outbox.' : 'Your message is in. You’ll receive an acknowledgement by email, and I’ll follow up personally.'}</p><a class="contact-return" href="/blog">Back to the journal ${arrow}</a></div>`
    : unavailable
      ? `<div class="contact-confirmation"><span class="contact-kicker">Keep the conversation going</span><h2 id="enquiry-title">Email me directly.</h2><a class="contact-return" href="mailto:hello@wyassine.com">hello@wyassine.com ${arrow}</a></div>`
      : `<div class="contact-form-heading"><h2 id="enquiry-title">Your enquiry</h2><span class="contact-kicker">All fields required</span></div>${form}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="theme-color" content="#0b0c0c"><title>${title} — Yassine W. Medjati</title><link rel="icon" href="/favicon.ico"><link rel="preload" href="/assets/fonts/instrument-sans-normal.woff2" as="font" type="font/woff2" crossorigin><link rel="stylesheet" href="/typography-fonts.css"><link rel="stylesheet" href="/site-motion.css"><link rel="stylesheet" href="/contact-page.css"></head>
  <body><a class="contact-skip" href="#enquiry">Skip to enquiry</a><div class="contact-page">
    <header class="contact-header"><a class="contact-brand" href="/" aria-label="Yassine W. Medjati — home"><img src="/assets/brand/logo-ivory.png" alt="" width="42" height="36"><span>Yassine W. Medjati</span></a><a class="contact-back" href="/blog">Back to the journal ${arrow}</a></header>
    <main class="contact-layout"><section class="contact-introduction" aria-labelledby="contact-title"><p class="contact-kicker"><span aria-hidden="true">↳</span> A conversation / A new perspective</p><h1 id="contact-title">${heading}</h1><p class="contact-deck">${intro}</p><div class="contact-scope"><span>Business</span><span>Advisory</span><span>Recruitment</span></div><div class="contact-orbit" aria-hidden="true"><svg viewBox="0 0 360 160" fill="none"><ellipse cx="180" cy="80" rx="150" ry="46"/><ellipse cx="180" cy="80" rx="150" ry="46" transform="rotate(-18 180 80)"/><ellipse cx="180" cy="80" rx="150" ry="46" transform="rotate(18 180 80)"/><path d="M0 80h360M180 0v160" stroke-dasharray="2 6"/><circle cx="318" cy="61" r="3"/></svg><span>Different perspectives.<br>A shared starting point.</span></div></section>
    <section id="enquiry" class="contact-form-section" aria-labelledby="enquiry-title">${message ? `<p class="contact-error" role="alert">${escape(message)}</p>` : ''}${state}</section></main>
    <footer class="contact-footer"><span>© ${new Date().getUTCFullYear()} Yassine W. Medjati</span><a href="mailto:hello@wyassine.com">Prefer email? <span>hello@wyassine.com</span> ${arrow}</a><a href="/privacy">Privacy</a></footer>
  </div></body></html>`;
}
module.exports={contactPage};
