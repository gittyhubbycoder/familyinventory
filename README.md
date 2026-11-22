# Family Inventory Web App

A React + Vite web app for editing the existing Supabase `public.inventory` table. It uses Supabase Auth email/password sign-in and the browser-safe **publishable** key. It never contains the Supabase secret key or the ESP32 device token.

## Features
- Email/password sign-in (no public sign-up form)
- View, search and filter inventory
- Add, edit and delete items
- Category and location filters are built from the current inventory
- Responsive layout for phones, tablets and computers
- Saves changes directly to Supabase
- Clear, specific on-screen errors when the database or configuration is wrong

---

## Deploy status

The site is live at **https://gittyhubbycoder.github.io/familyinventory/** and publishes automatically on every push to `main`.

### The three faults that were breaking it (all fixed)

Each was a separate failure, and each masked the next one, which is why it looked like nothing was ever being fixed:

| # | Symptom in Actions | Cause | Fix |
| --- | --- | --- | --- |
| 1 | `Configure Pages` failed: *"Get Pages site failed"* | Pages had never been enabled on the repo, so the API returned `404` before any upload happened | `actions/configure-pages` now runs with `enablement: true` |
| 2 | Same step, still failing after fix 1 | The repository was **private**; Pages on a private repo needs a paid plan | Repository made **public** |
| 3 | `Deploy` failed: *"No artifacts named \`github-pages\` were found for this workflow run"* — although `Upload Pages artifact` succeeded | `actions/deploy-pages@v4` can no longer read the artifact that `upload-pages-artifact@v3` produces on current runners | Upgraded to `actions/deploy-pages@v5` |

The action versions now match GitHub's own official `static` Pages starter workflow exactly: `configure-pages@v5` + `upload-pages-artifact@v3` + `deploy-pages@v5`. If you ever bump one of the three, bump them together — a mismatched set produces exactly the "No artifacts named github-pages" error above.

`concurrency` is also set to `cancel-in-progress: false`. Interrupting a deployment that is already running can leave the site stuck; superseded *queued* runs are still collapsed automatically.

> **The repository is public, so the Supabase URL and publishable key are visible** in the JavaScript bundle to anyone who opens the site. That is normal and unavoidable for a client-side app — it is safe *only* because Row Level Security protects the data. Keep the policies in step 1 in place and keep public sign-ups disabled. If you would rather not publish them, deploy `dist/` to a private host (Netlify/Vercel/Cloudflare Pages accept private repos) instead.

### If a future deploy fails

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Get Pages site failed` | Pages disabled, or Source is not "GitHub Actions" | [Settings → Pages](https://github.com/gittyhubbycoder/familyinventory/settings/pages) → Source = GitHub Actions |
| `No artifacts named "github-pages" were found` | Mismatched Pages action versions | Keep configure v5 / upload v3 / deploy v5 together |
| `Configure Pages` fails with 403 | Repo private on a free plan, or an org policy blocks it | Make it public, or upgrade |
| Deploy succeeds but the page is blank | Stale cached bundle | Hard-refresh (Ctrl/Cmd+Shift+R) |
| Page loads but shows "Configuration needed" | Build ran without env vars | Set the repository Variables below and rebuild |

---

## 1. Configure the database permissions

The original setup enabled RLS and revoked table privileges from `anon` and `authenticated`. Run this SQL in **Supabase Dashboard → SQL Editor**:

```sql
grant select, insert, update, delete on table public.inventory to authenticated;

drop policy if exists "Family members can read inventory" on public.inventory;
drop policy if exists "Family members can add inventory" on public.inventory;
drop policy if exists "Family members can update inventory" on public.inventory;
drop policy if exists "Family members can delete inventory" on public.inventory;

create policy "Family members can read inventory"
on public.inventory for select to authenticated
using (true);

create policy "Family members can add inventory"
on public.inventory for insert to authenticated
with check (true);

create policy "Family members can update inventory"
on public.inventory for update to authenticated
using (true) with check (true);

create policy "Family members can delete inventory"
on public.inventory for delete to authenticated
using (true);
```

These policies mean every authenticated account in this Supabase project can see and edit every row in this inventory table. Only use this project for the intended family members. Do not create public accounts for strangers. The `anon` role receives no table access.

## 2. Create family accounts

In **Supabase Dashboard → Authentication → Users**, create/invite an account for each family member. Keep public sign-ups disabled if you want only accounts you create to have access. Configure email/password authentication and email confirmation as appropriate. Family members sign in with the email/password credentials you arrange with them. Do not share one common account.

## 3. Configure the website

Install Node.js (LTS), then in this folder:

```powershell
npm install
Copy-Item .env.example .env
notepad .env
```

Set the two values in `.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Use the **Project URL** and **Publishable key** from Supabase → Project Settings → API Keys. Never put an `sb_secret_...` key, service-role key, database password, or ESP32 device token in this file.

Run locally:

```powershell
npm run dev
```

Open the address Vite prints (usually `http://localhost:5173`).

### Configuration is baked in at build time

`VITE_*` values are read when the site is **built**, not when it is opened. Two consequences:

- Changing `.env` requires a restart of `npm run dev`, or a rebuild for a deployed site.
- The deployed site does **not** use your local `.env`. It uses the values in the workflow (`.github/workflows/deploy.yml`).

## 4. Publish with GitHub Pages

The site publishes automatically on every push to `main`, and can be run by hand from the **Actions** tab.

The deployed URL is **https://gittyhubbycoder.github.io/familyinventory/**.

To point the deployed site at a different Supabase project, set repository **Variables** (Settings → Secrets and variables → Actions → **Variables** tab):

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://YOUR_PROJECT_REF.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_...` |

The workflow falls back to the values currently committed if the variables are not set. Builds use a **relative base path**, so the site works under `/familyinventory/` without any special configuration.

Add the published URL to **Supabase → Authentication → URL Configuration** → Site URL and Redirect URLs if your Auth settings ask for it.

## 5. Other hosting (private repositories)

`npm run build` produces a static site in `dist/`. Upload that folder to Netlify, Vercel, or Cloudflare Pages, add the same two environment variables in that host's settings, and redeploy. `dist/` is a plain static bundle with no server-side requirements.

---

## Troubleshooting the app itself

The app now explains common failures on screen instead of showing a raw API string:

| On-screen message | Meaning |
| --- | --- |
| `VITE_SUPABASE_URL is missing.` | Build ran without configuration. See "Configuration is baked in at build time". |
| `The "inventory" table does not exist in this Supabase project.` | `VITE_SUPABASE_URL` points at the wrong project (or the table was never created). |
| `Permission denied…` | Run the SQL in step 1 — grants or RLS policies for signed-in users are missing. |
| `Could not reach Supabase at …` | Wrong project URL, or offline. |
| `Supabase rejected the API key.` | The key is not the publishable key, or was regenerated in Supabase. |
| `Wrong email or password.` | Create/reset the user in Supabase → Authentication → Users. |

New items are submitted without an explicit `id`, so the database assigns it. If the `id` column happens to be a manually-managed integer with no default, the app falls back to computing `max(id) + 1`.

## Important: current ESP32 sync direction

The current firmware uploads unsynced local records to Supabase. It does not download records or edits from Supabase. Therefore edits made on this website are saved in the cloud but will not yet update the ESP32's local LittleFS inventory.

## Notes
- Deleting an item is permanent; the app asks for confirmation first.
- `synced` is set to true for browser-created/edited rows because the browser writes directly to the cloud table.
- The app expects the existing columns: `id`, `name`, `class`, `tags`, `location`, `qty`, `synced`, `updated_at`.
- The table name can be overridden with `VITE_INVENTORY_TABLE` if yours is not called `inventory`.
