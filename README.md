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

## TL;DR — why the deploy was failing

Every GitHub Actions run failed at the **Configure Pages** step with:

```
Get Pages site failed. Please verify that the repository has Pages enabled
and configured to build using GitHub Actions.
```

That is not a code problem — the `Build website` step always succeeded. There were two causes, and **both must be fixed for the site to publish**:

1. **GitHub Pages had never been switched on for this repository.** A repository has no Pages site until one is created, so the API returns `404` and the action aborts before uploading anything.
2. **This repository was private.** GitHub Pages for a private repository requires a paid plan (Pro/Team/Enterprise). The workflow file alone cannot change either of these; they are account settings.

### Do these two things once (2 clicks)

1. Set Pages source: **[Settings → Pages](https://github.com/gittyhubbycoder/familyinventory/settings/pages) → Build and deployment → Source = "GitHub Actions"**
2. If the repository is still private, either make it public (**Settings → General → Danger Zone → Change visibility → Public**) or keep it private and put the GitHub account on **Pro**.

Then re-run the workflow: **Actions → "Deploy Family Inventory to GitHub Pages" → Run workflow**.

> **Before making it public:** a client-side web app cannot hide its Supabase URL and publishable key — they end up in the JavaScript bundle and are visible to anyone. That is by design and is safe *only* because Row Level Security protects your data. The publishable key grants no table access to anonymous visitors as long as the policies in step 1 below are in place and public sign-ups stay disabled. If you would rather not publish them, deploy to a private host (Netlify/Vercel/Cloudflare Pages support private Git repos) instead of GitHub Pages.

The workflow already creates the Pages site itself on a public repo (`enablement: true`), so the Settings change in step 1 is usually only needed if the first run still reports 403.

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

### If the deploy still fails

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Get Pages site failed` / `Failed to create deployment (status: 404)` | Pages is not enabled, or Source is not "GitHub Actions" | Settings → Pages → Source = GitHub Actions |
| `Configure Pages` fails with 403 | Private repo on a free plan, or org policy | Make it public, or upgrade |
| Deploy succeeds but the page is blank | Stale cached bundle | Hard-refresh (Ctrl/Cmd+Shift+R) |
| Page loads but shows "Configuration needed" | Build had no env vars | Set the repository Variables above and rebuild |

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
