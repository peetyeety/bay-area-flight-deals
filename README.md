# Bay Area Flight Deals

A locally runnable MVP for reviewing airfare deals from SFO, SJC, and OAK, persisting approvals in Supabase, and generating an Instagram-ready image and caption.

## Run locally

Requires Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000/deals](http://localhost:3000/deals).

## First-deliverable walkthrough

1. Sort or filter the candidate queue on `/deals`.
2. Open **Tokyo** (`SFO → NRT`).
3. Review the $387 nonstop ZIPAIR fare and Bay Area airport comparison.
4. Click **Verify Deal**.
5. Click **Generate Instagram Post**.
6. Edit or copy the caption, and download the generated 1080×1350 PNG.

The project starts with realistic mock data. Set `FLIGHT_PROVIDER=serpapi` after adding a SerpApi key to switch the same scanner button and CLI command to live airfare discovery.

## Live airfare scanner

1. Create a free [SerpApi account](https://serpapi.com/users/sign_up).
2. Copy the private API key shown in the account dashboard into `.env.local` as `SERPAPI_API_KEY`.
3. Set `FLIGHT_PROVIDER=serpapi`.
4. Restart `npm run dev`, then click **Run live scan**, or run `npm run scan`.

The scanner uses three Google Flights Deals requests—one each for SFO, SJC, and OAK. It accepts only fares at least `DEAL_MIN_DISCOUNT_PERCENT` below Google's reported average price (30% by default), ranks the queue by largest discount, and saves up to 12 candidates plus raw observations to Supabase. Each candidate includes a direct Google Flights link and still requires human verification before publishing.

Amadeus support remains in the code as an optional provider, but Amadeus's new Self-Service onboarding has been decommissioned and is not the recommended setup for this MVP.

## Supabase setup

1. Run `supabase/schema.sql` in the Supabase SQL Editor.
2. Copy `.env.example` to `.env.local` and enter the project URL, publishable key, and server-only secret key.
3. Run `npm run seed` once to load the development fares.
4. Run `npm run setup:storage` once to create public Instagram image storage.

The dashboard uses `SupabaseAirfareProvider`; the fixture data remains separate so a production airfare source can replace it without changing the interface.

## Commands

```bash
npm run dev    # local development server
npm run build  # production build
npm run lint   # static checks
npm run scan   # run the configured mock or Amadeus fare-ingestion pipeline
npm run seed   # load development deals into Supabase
```
