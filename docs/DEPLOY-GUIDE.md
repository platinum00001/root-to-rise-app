# Root to Rise — Deploy guide (GitHub + Vercel + Supabase + Sveltia CMS)

This site is plain static files. No build step, no server code. Total time for a first-time setup: ~30–45 minutes.

---

## 1. GitHub (the source of truth)
The code lives at **https://github.com/platinum00001/root-to-rise** (public).

To start fresh elsewhere:
1. Sign in to GitHub → **New repository** → name `root-to-rise` → Public → Create.
2. Upload all files (drag-and-drop in the browser, or `git push`).
3. Everything editors change in `/admin` is committed here, so the repo history is also your content history and backup.

> Never commit secrets. The Supabase **anon** key is safe to publish (it's protected by Row Level Security). A **service-role** key must never be committed.

## 2. Vercel (hosting, auto-deploys)
1. Sign in at https://vercel.com with GitHub.
2. **Add New → Project → Import** `root-to-rise`.
3. Framework preset: **Other**. Build command: *(leave empty)*. Output directory: *(leave empty / root)*. Click **Deploy**.
4. **Make it public:** Project → **Settings → Deployment Protection** → turn **Vercel Authentication** *off* (otherwise visitors see a Vercel login screen).
5. Every push to `main` (including /admin edits) redeploys automatically.
6. Optional custom domain: Settings → **Domains** → add e.g. `roottorise.org` and follow the DNS instructions. Then update `site_url` in `admin/config.yml` and `SITE_URL` in `config.js`.

The included `vercel.json` only adds safe security headers and no-cache for `data/*.json`.

## 3. Supabase (member accounts — optional)
Without Supabase the checker, resource finder, offers list, and privacy pages work fully; account and opt-in areas show "Accounts coming soon".

1. Sign in at https://supabase.com → **New project** → name `root-to-rise`, choose the free plan and a region near New England (e.g. East US). Save the database password somewhere safe (it is **not** needed by the website).
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**. This creates:
   - `profiles` (one row per user, auto-created on signup)
   - `eligibility_answers` (checker answers a member **chose** to save: `save_consent` must be true, `includes_health_data` records the separate health-answers consent)
   - `notification_consent` (opt-in flag, exact consent text, timestamps, secret `unsubscribe_token`)
   - Row Level Security so each user can only read/write **their own** rows
   - `unsubscribe_by_token(uuid)` function for one-click unsubscribe without signing in
3. **Authentication → Providers → Email**: keep Email enabled. Recommended: leave "Confirm email" **on**.
4. **Authentication → URL Configuration**: Site URL = `https://root-to-rise.vercel.app` (or your domain); add the same URL + `/account.html` to Redirect URLs.
5. **Project Settings → API**: copy the **Project URL** and the **anon / publishable** key.
6. Edit `config.js` in GitHub:
   ```js
   window.RTR_CONFIG = {
     SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
     SUPABASE_ANON_KEY: "YOUR-ANON-KEY",
     SITE_URL: "https://root-to-rise.vercel.app"
   };
   ```
   Commit → Vercel redeploys → sign-up, saving answers, and opt-in now work.
7. Test: create an account, run the checker, tick **Save my answers** and press **Save my answers** (check that health answers are left out unless you tick the second box), delete it again in My account, opt in on Offers, then open the unsubscribe link shown under the checkbox.

**Emails:** v1 never sends offer emails. Consent is stored only. If you add sending later, use a transactional email service from a server/Edge Function, include the `unsubscribe.html?token=…` link in every message, and only email rows where `opted_in = true`.

**Exporting opted-in contacts (admins only):** in the Supabase Table editor you can view `notification_consent`. Never export health answers for marketing — that violates the privacy policy.

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
- Eligibility: copy the new `eligibility-rules.json` to `data/` (and `screen.js` to `js/` if it changed), then run `node tests/screen.test.js`.
- Resources: `python3 tools/import_navigator_resources.py PATH/TO/resources.json`.
- Validate with `python3 -m json.tool FILE`, then commit. Vercel redeploys automatically. Details: `docs/DATA-FORMAT.md`.

## 6. Launch checklist
- [ ] Deployment Protection off; site loads for a logged-out visitor
- [ ] Crisis bar visible on every page (header + footer)
- [ ] `node tests/screen.test.js` passes; SNAP NH October 2026 limit updated when NH DHHS publishes it
- [ ] Sample offer replaced or kept clearly labeled
- [ ] Supabase configured (optional) and signup/save/opt-in/unsubscribe tested
- [ ] `/admin` sign-in works for at least one editor
- [ ] Privacy policy date and contact details correct
