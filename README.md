# Family Inventory Web App

A small React + Vite web app for editing the existing Supabase `public.inventory` table. It uses Supabase Auth email/password login and the browser-safe publishable key. It does not contain or need the Supabase secret key or ESP32 device token.

## Features
- Email/password sign-in (no public sign-up form)
- View, search and filter inventory
- Add, edit and delete items
- Category and location filters are built from the current inventory
- Responsive layout for phones, tablets and computers
- Saves changes directly to Supabase

## 1. Configure the database permissions

The original setup enabled RLS and revoked table privileges from `anon` and `authenticated`. Run this SQL in Supabase Dashboard → SQL Editor:

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

In Supabase Dashboard → Authentication → Users, create/invite an account for each family member. Keep public sign-ups disabled if you want only accounts you create to have access. Configure email/password authentication and email confirmation as appropriate. Family members sign in using the email/password credentials you arrange with them. Do not share one common account.

## 3. Configure the website

Install Node.js (LTS), then open a terminal in this folder:

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

Use the Project URL and Publishable key from Supabase → Project Settings → API Keys. Never put an `sb_secret_...` key, service-role key, database password, or ESP32 device token in this file.

Run locally:

```powershell
npm run dev
```

Open the local address Vite prints (usually `http://localhost:5173`).

## 4. Publish it for your family

Build the static site:

```powershell
npm run build
```

The deployable website is in the `dist` folder. Publish that folder with a static hosting provider such as Netlify or Vercel. Add the same two environment variables in the hosting project's environment-variable settings, then redeploy. Add the final website URL to Supabase Authentication → URL Configuration → Site URL and Redirect URLs if prompted by your Auth configuration.

## Important: current ESP32 sync direction

The current firmware uploads unsynced local records to Supabase. It does not download records or edits from Supabase. Therefore edits made on this website are saved in the cloud but will not yet update the ESP32's local LittleFS inventory. Also, the website assigns a new numeric ID as `max(existing id) + 1`; this is adequate for a single shared web editor in simple use, but is not a robust multi-device ID allocator. Before enabling concurrent editing from multiple devices or full two-way sync, move ID generation to a database sequence/UUID and implement conflict-aware two-way sync.

## Notes
- Deleting an item is permanent; the app asks for confirmation first.
- `synced` is set to true for browser-created/edited rows because the browser writes directly to the cloud table.
- The app expects the existing columns: `id`, `name`, `class`, `tags`, `location`, `qty`, `synced`, `updated_at`.
