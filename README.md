# Clean Cut Barber Shop &amp; Shoe Shine

The website for Clean Cut Barber Shop — 430 NW 5th Ave, Gainesville, FL 32601 — replacing the
old Wix site. Static HTML, CSS and vanilla JavaScript. No build step, no dependencies,
no framework. Deployed on Vercel.

**Live:** https://clean-cut-barbershop.vercel.app

## What's in it

| File | What it does |
| --- | --- |
| `index.html` | The whole page: hero, services &amp; prices, booking form, about, hours, footer |
| `styles.css` | All styling, dark theme, responsive down to 320px |
| `app.js` | Booking flow, time-slot generation, live open/closed status |
| `accessibility.html` | Public accessibility statement — the standard followed, what was tested, known gaps |
| `vercel.json` | Clean URLs, cache headers for images, basic security headers |
| `images/` | Shop interior photo (hero + mobile crop) and the social share image |

## The booking flow

Three steps on one page — service → day and time → name and number — then a review panel that
shows the exact message and sends it to the shop as a prefilled text.

Two things worth knowing:

- **Times are generated from the real posted hours.** Slots come in 30-minute increments,
  the last one is 30 minutes before close, Sunday is closed, and today's slots that are less
  than 45 minutes away are dropped. Hours are evaluated in the shop's timezone
  (`America/New_York`), so the slots are right no matter where the visitor is.
- **It sends a request, not a confirmed appointment.** The page says so plainly. The shop
  replies by text or call to confirm.

### Changing where requests go

Top of `app.js`:

```js
const SHOP_PHONE = '+13523764489';   // texts land here
const BOOKING_EMAIL = '';            // add an address to turn on the "Send as an email" button
```

`BOOKING_EMAIL` is empty, so the email button is hidden and visitors get **Send as a text**
plus **Copy details**. Drop the shop's email address in and the email button appears
automatically — no other change needed.

## Editing the content

- **Prices** live in two places and both need updating: the printed list in `index.html`
  (`.price-list`) and the `SERVICES` / `ADDONS` arrays in `app.js` that the booking form reads.
- **Hours** live in two places as well: the `HOURS` object in `app.js` (24-hour numbers, which
  drives both the open/closed pill and the bookable time slots) and the `#hours-table` rows in
  `index.html`. The opening-hours block in the JSON-LD at the top of `index.html` should match too,
  since that's what Google reads.
- **Phone number** appears in the header, hero, visit card, footer and `SHOP_PHONE` in `app.js`.

## Accessibility

The site targets **WCAG 2.1 Level AA**, the benchmark the DOJ's
[web accessibility guidance](https://www.ada.gov/resources/web-guidance/) points to and the standard it
adopted for Title II entities in April 2024. The ADA itself defines no technical standard for websites,
so "AA conformance" is the meaningful claim here — not "ADA compliant", which nothing can certify.

Audited 15 October 2026 with WAVE, axe-core 4.10.2 and by hand:

- **WAVE:** 0 errors, 0 contrast errors
- **axe-core** (WCAG 2.0/2.1 A+AA, 2.2 AA, best-practice): 0 violations
- **By hand:** contrast computed from the color values (including sampling the hero photo's pixels behind
  the headline), full booking flow by keyboard only, heading/landmark/focus-order review, layout at
  320–1440px, and a text-spacing override pass

Eight issues were found and fixed; `accessibility.html` documents the outcome for the shop to point
customers at. Two things to keep in mind when editing:

- **Contrast.** Text colors are tuned to clear 4.5:1 against their specific background. The hero copy sits
  over a photograph and depends on the scrim in `.hero-shade` — if you lighten that gradient or swap the
  photo, re-measure the hero text before shipping.
- **Selection is shape, not color.** Chips in the booking form show a tick in a box when selected
  (`.chip span::before/::after`). Don't reduce that to a color change — it's what keeps the form clear of
  "color alone" as a means of conveying information.

Not yet done, and stated plainly on the page: no testing with a real screen reader (JAWS/NVDA/VoiceOver)
and no review by disabled users. That's the next step, and automated tools don't substitute for it.

## Running it locally

No install needed:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploying

Vercel builds from the `main` branch — push and it ships. There's no build command;
Vercel serves the files as-is.

---

Content, prices, hours and shop history carried over from the original Wix site.
Hero photo is the shop's own interior shot.
