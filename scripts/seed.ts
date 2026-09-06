import { createClient } from '@supabase/supabase-js';
import { deals } from '../lib/deals.ts';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !secretKey) throw new Error('Supabase credentials are missing.');

const supabase = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function databaseDate(displayDate: string) {
  const month = displayDate.split(' ')[0];
  const year = ['Jan', 'Feb', 'Mar'].includes(month) ? 2027 : 2026;
  return new Date(`${displayDate}, ${year} 12:00:00 UTC`).toISOString().slice(0, 10);
}

function minutesAgo(displayValue: string) {
  const amount = Number.parseInt(displayValue, 10);
  const minutes = displayValue.includes('hr') ? amount * 60 : amount;
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

const dealRows = deals.map((deal) => ({
  id: deal.id,
  provider: 'mock',
  provider_reference: deal.id,
  origin: deal.origin,
  destination_airport: deal.destinationAirport,
  destination_city: deal.destinationCity,
  destination_country: deal.destinationCountry,
  region: deal.region,
  price: deal.price,
  typical_price: deal.typicalPrice,
  percent_below_typical: deal.percentBelowTypical,
  score: deal.score,
  airline: deal.airline,
  nonstop: deal.nonstop,
  outbound_date: databaseDate(deal.outboundDate),
  return_date: databaseDate(deal.returnDate),
  status: 'candidate',
  last_seen_at: minutesAgo(deal.seenAgo),
}));

const { error: dealError } = await supabase.from('deals').upsert(dealRows, { onConflict: 'id' });
if (dealError) throw dealError;

const comparisonRows = deals.flatMap((deal) =>
  deal.comparison.map((comparison) => ({
    deal_id: deal.id,
    airport: comparison.airport,
    price: comparison.price,
  })),
);

const { error: comparisonError } = await supabase
  .from('airport_comparisons')
  .upsert(comparisonRows, { onConflict: 'deal_id,airport' });
if (comparisonError) throw comparisonError;

console.log(`Seeded ${deals.length} deals and ${comparisonRows.length} airport comparisons.`);
