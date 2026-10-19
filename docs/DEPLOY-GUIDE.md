# Root to Rise — Deploy guide (GitHub Pages + Supabase + Sveltia CMS)

This site is plain static files. No build step, no server code. Total time for a first-time setup: ~30–45 minutes.

---

## 1. GitHub (the source of truth)
The code lives at **https://github.com/platinum00001/root-to-rise-app** (public). Everything editors change in `/admin` is committed here, so the repo history is also your content history and backup.

> Never commit secrets. The Supabase **publishable / anon** key in `config.js` is safe to publish (Row Level Security protects the data). A **service_role / secret** key must never be committed. `node tests/paths.test.js` checks this.

## 2. Hosting — GitHub Pages (live now)
- Live site: **https://platinum00001.github.io/root-to-rise-app/**
- Repo → **Settings → Pages**: Source = *Deploy from a branch*, Branch = `main` / `(root)`. Every push to `main` republishes in about a minute.
- The site lives on a sub-path (`/root-to-rise-app/`), so all links are relative (`css/styles.css`, not `/css/styles.css`). `tests/paths.test.js` fails if a root-absolute link sneaks in.
- Optional custom domain later (e.g. `roottorise.org`): Settings → Pages → Custom domain, then update `SITE_URL` in `config.js`, `site_url` in `admin/config.yml`, and add the new address to Supabase Redirect URLs (step 3B).
- Vercel also works (the included `vercel.json` adds security headers): import the repo, preset **Other**, no build command. Note Vercel's free Hobby plan is for non-commercial use.

## 3. Supabase (member accounts — connected)
The site uses the shared Supabase project **james-sites** (`oiousqgzqcjanikglkxl`). This app's tables live in their **own schema, `rtr_app`**, so they never touch other sites' tables. Already done:
- `supabase/schema.sql` installed (migration `rtr_app_v1_live`): `rtr_app.profiles`, `eligibility_answers` (only saved with consent; health answers need a second consent), `notification_consent` (opt-in only, one-click `unsubscribe_token`), `offer_code_requests` (unique 8-character codes + QR), `admins`, `partner_staff`. Row Level Security on every table: members see only their own rows; the public key can read nothing. Staff tools use narrow functions (`admin_stats`, `lookup_code`, `redeem_code`) that return totals or code status only — never who a member is.
- `config.js` has the project URL, the **publishable** key and `SUPABASE_SCHEMA: "rtr_app"`.

### 3A. Make the `rtr_app` schema visible to the website (1 minute) — REQUIRED
1. Go to https://supabase.com/dashboard/project/oiousqgzqcjanikglkxl
2. Left menu **Project Settings** (gear) → **Data API** (in newer dashboards: **Integrations → Data API → Settings**).
3. Under **Exposed schemas**, click the box and add **`rtr_app`** (keep `public` and `graphql_public`; if Recovery Milestones is live, also add `milestones`). Click **Save**.
4. Check: open https://platinum00001.github.io/root-to-rise-app/account.html, sign in — you should see “My profile”, not “Member features are being switched on”.

### 3B. Allow sign-in links to come back to this site (1 minute) — REQUIRED
1. **Authentication → URL Configuration**.
2. Leave **Site URL** as it is (other sites share this project).
3. Under **Redirect URLs** click **Add URL** → `https://platinum00001.github.io/root-to-rise-app/**` → **Save**. Don't remove the existing entries.

### 3C. Let sign-in emails reach everyone (10 minutes) — REQUIRED for email link / sign-up
Supabase's built-in mailer only delivers to members of your Supabase team and only a few emails per hour, so real members won't get confirmation or sign-in-link emails until you add a sender:
1. Create a free account at https://resend.com → **Domains → Add domain** (a domain you own, e.g. `roottorise.org`) → add the DNS records it shows → wait for “Verified”. *(No domain yet? Buy one first; a gmail.com address can't be used as a sender.)*
2. Resend → **API Keys → Create API key** (Sending access). Copy it.
3. Supabase → **Authentication → Emails → SMTP Settings** → **Enable custom SMTP**: Host `smtp.resend.com`, Port `465`, Username `resend`, Password = the API key, Sender email `no-reply@YOUR-DOMAIN`, Sender name `Root to Rise`. **Save**.
4. **Authentication → Rate Limits**: raise “emails per hour” to e.g. 100.
5. Optional: **Authentication → Emails → Templates** — reword “Confirm signup” / “Magic Link” to mention Root to Rise. (These templates are shared with other sites in this project, so keep the wording general, e.g. “Your sign-in link”.)
6. Recommended: **Authentication → Providers → Email** → turn on **Leaked password protection** (Pro plan only; skip on Free).

### 3D. Google sign-in (“Continue with Google”) — about 10 minutes
The button already exists; until this is done it politely says “Google sign-in is coming soon”. Note: the Google login is project-wide, so the same Google client also serves Recovery Milestones — name it generally.
1. Go to https://console.cloud.google.com/ → top bar project picker → **New project** → name `James Sites Login` → **Create** → select it.
2. Left menu **APIs & Services → OAuth consent screen** (now called **Google Auth Platform**) → **Get started**:
   - **App name**: `Root to Rise` (or a shared name such as `Root to Rise & Recovery Milestones`); **User support email**: your Gmail → **Next**.
   - **Audience**: **External** → **Next**. **Contact information**: your email → **Next** → tick agree → **Create**.
3. **Branding** (left menu): App home page `https://platinum00001.github.io/root-to-rise-app/`, Privacy policy `https://platinum00001.github.io/root-to-rise-app/privacy.html`, Authorized domains → **Add domain** → `supabase.co` → **Save**.
4. **Data Access** → **Add or remove scopes** → tick `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `openid` → **Update** → **Save**.
5. **Audience** → **Publish app** → **Confirm** (status “In production”; no Google review is needed for these basic scopes).
6. **Clients** → **Create client** → Application type **Web application** → Name `Supabase`:
   - **Authorized JavaScript origins** → Add `https://platinum00001.github.io`
   - **Authorized redirect URIs** → Add **`https://oiousqgzqcjanikglkxl.supabase.co/auth/v1/callback`**
   - **Create** → copy the **Client ID** and **Client secret** (keep the secret private — never put it in the repo).
7. Supabase → **Authentication → Sign In / Providers → Google** → toggle **Enable** → paste **Client ID** and **Client Secret** → **Save**.
8. Test: open the account page in a private window → **Continue with Google**.

### 3E. Facebook sign-in (“Continue with Facebook”) — about 15 minutes
1. Go to https://developers.facebook.com/apps → **Create app** → app name `Root to Rise` → contact email → **Next**.
2. Use case: **Authenticate and request data from users with Facebook Login** → **Next** → business portfolio: “I don't want to connect a business portfolio yet” (or pick Inspiration Is Everywhere) → **Next** → **Create app** (re-enter your Facebook password if asked).
3. **Use cases → Authenticate and request data… → Customize**: under **Permissions**, make sure **email** shows “Ready for testing” → click **Add** next to `email` if needed (`public_profile` is always on).
4. In the same use case → **Settings** (Facebook Login settings):
   - **Valid OAuth Redirect URIs**: **`https://oiousqgzqcjanikglkxl.supabase.co/auth/v1/callback`**
   - Leave Client OAuth login and Web OAuth login **On** → **Save changes**.
5. **App settings → Basic**:
   - **Privacy Policy URL**: `https://platinum00001.github.io/root-to-rise-app/privacy.html`
   - **User data deletion**: choose “Data deletion instructions URL” → `https://platinum00001.github.io/root-to-rise-app/privacy.html#data-deletion`
   - **App icon** (1024×1024; you can use `images/favicon.svg` exported to PNG), **Category**: Lifestyle (or Health & fitness) → **Save changes**.
   - Copy the **App ID** and click **Show** to copy the **App secret** (keep it private).
6. Top of the page: switch **App Mode** from *Development* to **Live** (Facebook may ask you to finish the items above first; basic `email`/`public_profile` don't need App Review).
7. Supabase → **Authentication → Sign In / Providers → Facebook** → **Enable** → paste **Facebook client ID** (= App ID) and **Facebook secret** (= App secret) → **Save**.
8. Test in a private window → **Continue with Facebook**.

**Linking accounts:** Supabase links Google, Facebook, password and email-link sign-ins that use the **same verified email** into one account automatically, so a member who first used email and later taps “Continue with Google” keeps their saved data.

### 3F. Make yourself (and partners) staff
1. Sign in to the site once with the email you'll use as admin (e.g. roottorisema@gmail.com).
2. Supabase → **SQL Editor → New query** → paste and **Run**:
   ```sql
   insert into rtr_app.admins (user_id, note)
   select id, 'James – admin' from auth.users where email = 'roottorisema@gmail.com'
   on conflict do nothing;
   ```
3. Reload https://platinum00001.github.io/root-to-rise-app/staff.html — you'll see totals (sign-ups, eligibility checks saved, offer opt-ins, codes issued/redeemed), a **Download CSV (totals only)** button, and the code-redemption box. A **Staff dashboard** button also appears in My account.
4. Partner staff who should only redeem codes for their own offer (offer ids are in `data/offers.json`):
   ```sql
   insert into rtr_app.partner_staff (user_id, offer_id)
   select id, 'sample-lifeline-free-phone' from auth.users where email = 'partner@example.org'
   on conflict do nothing;
   ```
   Remove access: `delete from rtr_app.admins where user_id = (select id from auth.users where email = '…');` (same for `partner_staff`).

### What members can do
- Create an account (email link, password, Google or Facebook) — creating one never signs them up for emails.
- **Benefits checker:** answers stay in the browser; saving needs an unchecked “Save my answers” box, and health answers need a second box.
- **Partner offers:** “Request a code” → unique 8-character code + QR, also listed in My account; staff mark it redeemed on `staff.html`.
- **Offer notifications:** opt-in checkbox (never pre-checked), one-click unsubscribe link (`unsubscribe.html?token=…`).
- **My account:** edit profile, delete single answers / all answers / codes, or **Delete all my Root to Rise data**.

**Emails:** the website still never sends offer emails; it only stores consent. If you add sending later, send from a server/Edge Function, include the `unsubscribe.html?token=…` link in every message, and only email rows where `opted_in = true`. Never use health answers for marketing.

## 4. Sveltia CMS editors (`/admin`)
`admin/config.yml` already points to `platinum00001/root-to-rise` on branch `main`, with collections for **Resources**, **Eligibility checker** (extras/pointers), **Partner offers**, and **Page text**. The income tables in `data/eligibility-rules.json` are updated through the Navigator data files, not /admin.

### Give someone editing access
1. GitHub repo → **Settings → Collaborators → Add people** → invite the editor's GitHub account (they need a free GitHub account). Role: *Write*.

### Option A — quick start: personal access token (no setup)
1. The editor creates a fine-grained token: GitHub → Settings → Developer settings → **Fine-grained tokens** → *Generate new token* → Repository access: *Only select repositories* → `root-to-rise` → Permissions: **Contents: Read and write** → Generate.
2. Go to `/admin/` → **Sign in with Token** → paste. Done.

### Option B — "Sign in with GitHub" button (recommended for non-technical editors)
Sveltia needs a tiny OAuth helper. The free, official one is **sveltia-cms-auth** on Cloudflare Workers:
1. Create a free Cloudflare account.
2. Open https://github.com/sveltia/sveltia-cms-auth and click **Deploy to Cloudflare Workers** (or follow its README). Note the worker URL, e.g. `https://sveltia-cms-auth.YOUR-NAME.workers.dev`.
3. Create a GitHub OAuth App: GitHub → Settings → Developer settings → **OAuth Apps → New OAuth App**
   - Application name: `Root to Rise CMS`
   - Homepage URL: `https://root-to-rise.vercel.app`
   - Authorization callback URL: `https://sveltia-cms-auth.YOUR-NAME.workers.dev/callback`
   - Register → copy the **Client ID** → **Generate a new client secret** and copy it.
4. In Cloudflare → your worker → **Settings → Variables**, add:
   - `GITHUB_CLIENT_ID` = the Client ID
   - `GITHUB_CLIENT_SECRET` = the secret (mark as *Encrypt*)
   - `ALLOWED_DOMAINS` = `root-to-rise.vercel.app` (plus your custom domain if any, comma-separated)
5. In `admin/config.yml`, uncomment and set:
   ```yaml
   backend:
     name: github
     repo: platinum00001/root-to-rise
     branch: main
     base_url: https://sveltia-cms-auth.YOUR-NAME.workers.dev
   ```
6. Commit. Editors now click **Sign in with GitHub** at `/admin/`.

The client secret lives only in Cloudflare — never put it in the repo.

## 5. Updating data from the Resource Navigator
- Eligibility: copy the new `eligibility-rules.json` to `data/` (and `screen.js` to `js/` if it changed), then run `node tests/screen.test.js && node tests/paths.test.js`.
- Resources: `python3 tools/import_navigator_resources.py PATH/TO/resources.json`.
- Validate with `python3 -m json.tool FILE`, then commit. GitHub Pages republishes automatically. Details: `docs/DATA-FORMAT.md`.

## 6. Launch checklist
- [x] Site live on GitHub Pages and loads for a logged-out visitor
- [ ] Crisis bar visible on every page (header + footer)
- [ ] `node tests/screen.test.js` passes; SNAP NH October 2026 limit updated when NH DHHS publishes it
- [ ] Sample offer replaced or kept clearly labeled
- [x] Supabase connected (`rtr_app` schema, config.js)
- [ ] 3A exposed schema, 3B redirect URL, 3C custom SMTP done
- [ ] 3D Google and 3E Facebook sign-in enabled and tested
- [ ] 3F admin role set; staff.html shows totals
- [ ] `/admin` sign-in works for at least one editor
- [ ] Privacy policy date and contact details correct
