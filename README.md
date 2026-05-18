# Food Truck Recipe Cost Calculator

Vite + React + TypeScript app backed by Supabase for ingredient, recipe, and menu item costing.

## Setup

1. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` plus `VITE_SUPABASE_ANON_KEY`.
2. Run `npm install`.
3. Apply the Supabase migration in `supabase/migrations/20260518120000_initial_schema.sql`.
4. Load seed data from `supabase/seed.sql`.
5. Run `npm run dev`.

## Supabase types

The app uses generated-style Supabase types in `src/lib/database.types.ts`. After changing the database, regenerate them with:

```sh
npm run types:supabase
```
