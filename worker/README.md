# "Have a Cup of Coffee" booking — setup guide

What it is: a small Cloudflare Worker (`worker.js`) + a D1 database (`schema.sql`) + the booking page (`/book/`).
Flow: visitor picks a slot → you get an email with **Approve / Decline** → the customer is emailed (with a calendar invite on approval).
The 10 KD fee is shown and agreed to, but not yet charged online (phase 2: payment gateway).

Cost: Cloudflare Workers + D1 free tier, Resend free tier (3,000 emails/month). Domain you already own.

## 1. Email sending (Resend)
1. Create an account at resend.com → **Domains → Add domain** `mesharialoud.com`.
2. Add the DNS records Resend shows (at name.com → DNS Records). Wait until it says *Verified*.
3. **API Keys → Create** (permission: Sending access). Copy the key.

## 2. Create the API (Cloudflare dashboard)
1. cloudflare.com → sign up / log in → **Workers & Pages → Create → Worker**. Name: `mesharialoud-booking` → Deploy → **Edit code**.
2. Delete the sample code, paste all of `worker.js`, **Deploy**.
3. **Storage & databases → D1 → Create database** `mesharialoud-bookings` → open it → **Console** → paste `schema.sql` → Run.
4. Back in the Worker → **Settings → Bindings → Add → D1 database**: variable name `DB`, pick `mesharialoud-bookings`.
5. Worker → **Settings → Variables and Secrets**:
   - Text variables: `OWNER_EMAIL` = its@mesharialoud.com · `FROM_EMAIL` = `Meshari Aloud <bookings@mesharialoud.com>` · `ALLOWED_ORIGINS` = `https://www.mesharialoud.com,https://mesharialoud.com`
   - Secrets: `RESEND_API_KEY` = (from step 1) · `SIGNING_SECRET` = any long random string (30+ characters)
6. Copy the Worker address (looks like `https://mesharialoud-booking.<you>.workers.dev`).

## 3. Connect the page
Edit `book/config.js` → `API_BASE: "<the worker address>"` and push. Open https://www.mesharialoud.com/book/ and send yourself a test booking.
Until `API_BASE` is filled, the page shows "booking opens soon" with WhatsApp/email buttons, so it is safe to leave unlinked.

## 4. Optional: bot protection (free)
Cloudflare → Turnstile → add site `www.mesharialoud.com` → put the **site key** in `book/config.js` (`TURNSTILE_SITEKEY`) and the **secret** as Worker secret `TURNSTILE_SECRET`.

## 5. Go live
Add a "Book a coffee" button on the main site pointing to `/book/`.

## Change your availability
Top of `worker.js`, `CONFIG`: days, start/end hours, slot length, how far ahead, blocked dates. Paste the new file in the Worker editor → Deploy.
Defaults: Sun–Thu, 17:00–20:00 Kuwait time, 30-minute slots, up to 21 days ahead, 12 hours minimum notice.

## Security notes
- Approve/Decline links are signed (HMAC); the link only shows a button, the decision happens on click (email scanners can't trigger it).
- One active booking per slot is enforced by the database. Unapproved requests free their slot after 48 hours.
- Rate-limited per visitor; hidden honeypot field; all user text is escaped in emails; secrets live only in Cloudflare.
- Customer data (name, phone, email, note) is stored in D1 — add a privacy notice before going live.

## CLI alternative
```
npm i -g wrangler && wrangler login
wrangler d1 create mesharialoud-bookings      # copy database_id into wrangler.toml
wrangler d1 execute mesharialoud-bookings --remote --file=schema.sql
wrangler secret put RESEND_API_KEY && wrangler secret put SIGNING_SECRET
wrangler deploy
```
