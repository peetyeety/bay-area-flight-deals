import { createSupabaseAdmin } from './supabase/admin.ts';
import { mockFlightDataProvider, type FlightDataProvider } from './providers/mock-provider.ts';
import type { AirportCode } from './deals.ts';

const origins: AirportCode[] = ['SFO', 'SJC', 'OAK'];

function databaseDate(displayDate: string) {
  const month = displayDate.split(' ')[0];
  const year = ['Jan', 'Feb', 'Mar'].includes(month) ? 2027 : 2026;
  return new Date(`${displayDate}, ${year} 12:00:00 UTC`).toISOString().slice(0, 10);
}

export async function runFareScan(provider: FlightDataProvider = mockFlightDataProvider) {
  const candidates = await provider.searchDeals(origins);
  const observedAt = new Date().toISOString();
  const supabase = createSupabaseAdmin();

  const dealRows = candidates.map((deal) => ({
    id: deal.id,
    provider: provider.name,
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
    last_seen_at: observedAt,
  }));

  const { error: dealError } = await supabase.from('deals').upsert(dealRows, { onConflict: 'id' });
  if (dealError) throw new Error(`Unable to save scanned deals: ${dealError.message}`);

  const observationRows = candidates.map((deal) => ({
    deal_id: deal.id,
    provider: provider.name,
    origin: deal.origin,
    destination_airport: deal.destinationAirport,
    price: deal.price,
    currency: 'USD',
    airline: deal.airline,
    nonstop: deal.nonstop,
    outbound_date: databaseDate(deal.outboundDate),
    return_date: databaseDate(deal.returnDate),
    observed_at: observedAt,
    raw_payload: deal,
  }));
  const { error: observationError } = await supabase.from('fare_observations').insert(observationRows);
  if (observationError) throw new Error(`Unable to save fare observations: ${observationError.message}`);

  const comparisonRows = candidates.flatMap((deal) =>
    deal.comparison.map((comparison) => ({
      deal_id: deal.id,
      airport: comparison.airport,
      price: comparison.price,
      checked_at: observedAt,
    })),
  );
  const { error: comparisonError } = await supabase
    .from('airport_comparisons')
    .upsert(comparisonRows, { onConflict: 'deal_id,airport' });
  if (comparisonError) throw new Error(`Unable to save airport comparisons: ${comparisonError.message}`);

  return {
    provider: provider.name,
    candidatesFound: candidates.length,
    observationsSaved: observationRows.length,
    completedAt: observedAt,
  };
}
