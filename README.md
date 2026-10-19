# Root to Rise v1

A calm, accessible recovery-community website for **Inspiration Is Everywhere / Root to Rise Recovery Cafe**, serving **Falmouth & Mashpee, MA** and **Nashua, NH**.

- Contact: roottorisema@gmail.com · 603-721-2088
- **Live site:** https://platinum00001.github.io/root-to-rise-app/ (GitHub Pages) · Content editor: `/admin` · Staff dashboard: `staff.html`
- **Repo:** https://github.com/platinum00001/root-to-rise-app
- **Accounts:** Supabase project `james-sites`, schema `rtr_app` (email link + password now; Google/Facebook buttons ready — see "Steps for James" below)

## What's in it
| Page | What it does |
|---|---|
| `index.html` | Mission, how the site helps, service areas |
| `eligibility.html` | Private benefits "may qualify" screener for 12 MA/NH programs (runs in the browser via `js/screen.js`). Shows the official source and "as of" date for every income limit. Answers stay in the browser; members can *choose* to save them. |
| `resources.html` | Resource finder — filter by zip, town, category, keyword |
| `offers.html` | Partner offers (one **sample** Lifeline offer), **Request a code** (unique 8-character code + QR), opt-in notification choice (never pre-checked) |
| `account.html` | Optional member account — Continue with Google / Facebook, email sign-in link, or password. Profile, saved answers, offer codes (with QR), notification status, delete-my-data |
| `staff.html` | Admins: aggregate totals + CSV export (no personal data). Admins and partner staff: check / mark offer codes redeemed |
| `unsubscribe.html` | One-click unsubscribe (`?token=…`) |
| `privacy.html` | Privacy policy — health data is never sold or shared for marketing |
| `admin/` | Sveltia CMS for non-technical editors |

Crisis resources (988 call/text, SAMHSA 1-800-662-4357, 911) are in the header **and** footer of every page and work without JavaScript. No tracking or analytics scripts. **This build never sends email** — it only stores consent.

## Tech
Plain HTML/CSS/vanilla JS. **No build step.** Deploys to any static host.

```
index.html  eligibility.html  resources.html  offers.html  account.html  staff.html  unsubscribe.html  privacy.html
config.js            ← Supabase URL + publishable key (public) + schema rtr_app. Empty URL = "accounts coming soon" mode
css/styles.css
js/                  ← screen.js (screener engine), common.js, eligibility.js, resources.js, offers.js, account.js, staff.js, unsubscribe.js, supabase-client.js
js/vendor/qrcode.js  ← qrcode-generator 1.4.4 (MIT, Kazuhiko Arase) for offer-code QR codes
data/                ← eligibility-rules.json, eligibility-extras.json, resources.json, offers.json, site.json   (see docs/DATA-FORMAT.md)
tests/               ← node tests/screen.test.js && node tests/paths.test.js
tools/               ← import_navigator_resources.py (HSDS → data/resources.json)
admin/               ← Sveltia CMS (index.html + config.yml)
supabase/schema.sql  ← rtr_app schema: tables, Row Level Security, staff functions (installed)
docs/                ← DATA-FORMAT.md, DEPLOY-GUIDE.md
```

## Run locally
```bash
cd root-to-rise-app
python3 -m http.server 8080
# open http://localhost:8080  (the live Supabase project answers from localhost too)
```
(Opening the HTML file directly with `file://` won't load the JSON data — use a local server.)

## Edit content without code (/admin)
1. Go to https://platinum00001.github.io/root-to-rise-app/admin/
2. Sign in with GitHub (you need write access to the `root-to-rise-app` repo — ask the owner to add you as a collaborator). Until the OAuth helper is set up, choose **"Sign in with token"** and paste a GitHub fine-grained personal access token with *Contents: read & write* on this repo. See `docs/DEPLOY-GUIDE.md`.
3. Pick a collection: **Resources**, **Eligibility checker** (extra questions and pointers), **Partner offers**, or **Page text**. Income limits are updated through the Navigator data files instead, so that every number keeps its official source (see `docs/DATA-FORMAT.md` §1). Edit and press **Save/Publish**.
4. Sveltia commits the change to GitHub; GitHub Pages republishes in about a minute.

Editing tips: only add phone numbers and addresses you have verified; fill in *Last verified*.

## Member accounts (connected)
Supabase is connected: `supabase/schema.sql` is installed in its own `rtr_app` schema of the shared `james-sites` project, and `config.js` has the project URL + **publishable** key (never a service_role key). Privacy rules built in: checker answers stay in the browser unless the member ticks an unchecked “save” box; health answers need a second box; members can delete everything; offer notifications are opt-in with one-click unsubscribe; no selling of health data; staff see totals only.

### Steps for James (click-by-click in `docs/DEPLOY-GUIDE.md` §3)
1. **§3A Expose the `rtr_app` schema** (Supabase → Project Settings → Data API → Exposed schemas → add `rtr_app` → Save). *Until this is done, signing in works but the member pages say “Member features are being switched on.”*
2. **§3B Redirect URL** (Authentication → URL Configuration → Redirect URLs → add `https://platinum00001.github.io/root-to-rise-app/**`).
3. **§3C Custom SMTP** (free Resend account) so confirmation and sign-in-link emails reach everyone, not just your Supabase team.
4. **§3D Google**: Google Cloud Console → consent screen → Web client with redirect URI `https://oiousqgzqcjanikglkxl.supabase.co/auth/v1/callback` → paste Client ID/secret into Supabase → Auth → Providers → Google.
5. **§3E Facebook**: developers.facebook.com → app with Facebook Login → same redirect URI → privacy + data-deletion URLs → Live mode → paste App ID/secret into Supabase → Auth → Providers → Facebook.
6. **§3F Admin role**: sign in once, then run the one-line SQL in §3F to add yourself to `rtr_app.admins`.

## Data status (v1) and credits
- **Data source:** eligibility rules, the `screen.js` screener and its tests, and most resource entries come from the **Root to Rise Resource Navigator** dataset for Inspiration Is Everywhere, Inc. (generated and verified **2026-09-26**). Main sources include HHS 2026 poverty guidelines, USDA FNS, MA DTA, MassHealth / MLRI, NH DHHS, the FCC Lifeline program, MA HEAP / SSCAC, NH Fuel Assistance / CAPHR, the WIC Federal Register notice, the Barnstable County Food Access Directory, MA Peer Recovery Support Centers, and the Greater Nashua Continuum of Care 2025 Resource Toolkit. Each program and each resource links to its own sources.
- **Eligibility rules:** verified thresholds (12 MA/NH programs) with a source and "as of" date for each. Results use "may qualify" wording only and are never a decision. Update schedule: `docs/DATA-FORMAT.md` §1.
- **Eligibility extras** (VA, recovery support, Health Connector/HealthCare.gov, SSI pointers): simple links written by the web team. They are not income-screened.
- **Resources:** 84 entries (Navigator: 78 services; web team: 6 more, e.g. MassHire, South Coastal Counties Legal Services, MASH, NH Works). Checked 2026-09-26. Many entries show "Call to confirm hours". Fields that could not be verified are left out.
- **Offers:** one **sample** offer (Lifeline free phone), clearly labeled.

## License / ownership
© Inspiration Is Everywhere / Root to Rise Recovery Cafe. Content is informational only — not medical, legal, or benefits advice.

## STATUS (Oct 19, 2026)
- **Live** on GitHub Pages: https://platinum00001.github.io/root-to-rise-app/ — all pages, CSS, JS and data load under the `/root-to-rise-app/` sub-path.
- **Supabase connected** (project `james-sites`, schema `rtr_app`, RLS verified). Email + password and email sign-in links work at the login level; Google/Facebook buttons show “coming soon” until James enables them.
- **Waiting on James:** steps 1–6 above (expose schema, redirect URL, SMTP, Google, Facebook, admin role).
