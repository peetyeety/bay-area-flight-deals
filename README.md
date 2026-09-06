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

The project starts with realistic mock data. Set `FLIGHT_PROVIDER=amadeus` after adding Amadeus credentials to switch the same scanner button and CLI command to live airfare discovery.

## Live airfare scanner

1. Create a free app in the [Amadeus for Developers dashboard](https://developers.amadeus.com/).
2. Copy its **API Key** and **API Secret** into `.env.local` as `AMADEUS_API_KEY` and `AMADEUS_API_SECRET`.
3. Set `FLIGHT_PROVIDER=amadeus` and leave `AMADEUS_ENV=test` while developing.
4. Restart `npm run dev`, then click **Run live scan**, or run `npm run scan`.

The scanner discovers cheap destinations from SFO, SJC, and OAK, checks current offers when available, retrieves median price metrics for scoring, and saves candidates plus observations to Supabase. Amadeus test mode contains a limited subset of data; production mode is needed for broad real-time coverage. Every candidate remains `needs_review` until a human verifies it.

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
