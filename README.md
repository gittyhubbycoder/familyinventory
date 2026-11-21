# Family Inventory

A mobile-friendly family inventory manager built with React, Vite and Supabase Auth. It reads and edits the existing `public.inventory` table.

## GitHub Pages

The deployment workflow publishes this repository at:

`https://gittyhubbycoder.github.io/familyinventory/`

The repository name is used in the Vite base path. Do not rename it without updating `.github/workflows/deploy.yml`.

1. In GitHub, open **Settings → Pages** and select **GitHub Actions** as the source.
2. Pushes to `main` automatically build and deploy the site.
3. In Supabase, open **Authentication → URL Configuration** and add the deployed URL to the allowed Redirect URLs. Set it as Site URL if this is the only frontend.

## Supabase configuration

The project URL is `https://crbnmqpgzgnldwiltgyq.supabase.co`. The browser app uses the Supabase publishable key only. A publishable key is designed to be exposed in browser code; never put the Supabase secret/service-role key or ESP32 device token in this repository.

The app uses email/password sign-in. Create family accounts in Supabase Authentication; public sign-up is not included.

## Database security

The app accesses `public.inventory` directly. Keep Row Level Security enabled and create policies granting the `authenticated` role only the read/insert/update/delete operations intended for family members. Do not rely on the UI login alone for database security.

## Notes

- The ESP32 currently uploads inventory but does not yet download website edits.
- New item IDs are generated as max(id) + 1. This is adequate for a single family editor at first, but should be replaced with a database sequence before multiple people add items simultaneously.
- The app expects the columns `id, name, class, tags, location, qty, synced, updated_at`.
