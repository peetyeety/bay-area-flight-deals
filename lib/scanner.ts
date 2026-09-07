import { createSupabaseAdmin } from './supabase/admin.ts';
import { configuredFlightProvider } from './providers/configured-provider.ts';
import type { FlightDataProvider } from './providers/types.ts';
import type { AirportCode } from './deals.ts';
import { scoreDeal } from './scoring.ts';

const origins: AirportCode[] = ['SFO', 'SJC', 'OAK'];

export function scannedDealId(provider: Pick<FlightDataProvider, 'name'>, candidate: { databaseId?: string; providerReference: string }) {
  if (candidate.databaseId) return candidate.databaseId;
  return `${provider.name}-${candidate.providerReference}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);
}

type HistoricalObservation = {
  origin: AirportCode;
  destination_airport: string;
  price: number;
};

function routeKey(origin: AirportCode, destination: string) {
  return `${origin}-${destination}`;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

async function historicalBaselines(provider: FlightDataProvider) {
  if (provider.name === 'mock') return new Map<string, number>();
  const since = new Date(Date.now() - 365 * 24 * 60 * 60 * 1_000).toISOString();
  const { data, error } = await createSupabaseAdmin()
    .from('fare_observations')
    .select('origin,destination_airport,price')
    .eq('provider', provider.name)
    .gte('observed_at', since)
    .limit(5_000);
  if (error) throw new Error(`Unable to load fare history: ${error.message}`);

  const grouped = new Map<string, number[]>();
  for (const row of (data ?? []) as HistoricalObservation[]) {
    const key = routeKey(row.origin, row.destination_airport);
    grouped.set(key, [...(grouped.get(key) ?? []), row.price]);
  }
  return new Map(
    [...grouped.entries()]
      .filter(([, prices]) => prices.length >= 3)
      .map(([key, prices]) => [key, median(prices)]),
  );
}

export async function runFareScan(provider: FlightDataProvider = configuredFlightProvider()) {
  const candidates = await provider.searchDeals(origins);
  const observedAt = new Date().toISOString();
  const supabase = createSupabaseAdmin();
  const baselines = await historicalBaselines(provider);
  const scoredCandidates = candidates.map((candidate) => {
    const typicalPrice = candidate.typicalPrice ?? baselines.get(routeKey(candidate.origin, candidate.destinationAirport));
    const calculated = scoreDeal({
      currentPrice: candidate.price,
      typicalPrice,
      nonstop: candidate.nonstop,
    });
    return {
      candidate,
      scoring: {
        ...calculated,
        percentBelowTypical: candidate.percentBelowTypical ?? calculated.percentBelowTypical,
        score: candidate.score ?? calculated.score,
      },
    };
  });

  const dealRows = scoredCandidates.map(({ candidate, scoring }) => ({
    id: scannedDealId(provider, candidate),
    provider: provider.name,
    provider_reference: candidate.providerReference,
    origin: candidate.origin,
    destination_airport: candidate.destinationAirport,
    destination_city: candidate.destinationCity,
    destination_country: candidate.destinationCountry,
    region: candidate.region,
    price: candidate.price,
    currency: candidate.currency,
    typical_price: scoring.typicalPrice,
    percent_below_typical: scoring.percentBelowTypical,
    score: scoring.score,
    airline: candidate.airline ?? 'Carrier not confirmed',
    nonstop: candidate.nonstop ?? false,
    outbound_date: candidate.outboundDate,
    return_date: candidate.returnDate,
    booking_url: candidate.bookingUrl ?? null,
    last_seen_at: observedAt,
  }));

  if (dealRows.length) {
    const { error: dealError } = await supabase.from('deals').upsert(dealRows, { onConflict: 'id' });
    if (dealError) throw new Error(`Unable to save scanned deals: ${dealError.message}`);
  }

  const observationRows = scoredCandidates.map(({ candidate }) => ({
    deal_id: scannedDealId(provider, candidate),
    provider: provider.name,
    origin: candidate.origin,
    destination_airport: candidate.destinationAirport,
    price: candidate.price,
    currency: candidate.currency,
    airline: candidate.airline ?? null,
    nonstop: candidate.nonstop ?? false,
    outbound_date: candidate.outboundDate,
    return_date: candidate.returnDate,
    booking_url: candidate.bookingUrl ?? null,
    observed_at: observedAt,
    raw_payload: candidate.rawPayload ?? candidate,
  }));
  if (observationRows.length) {
    const { error: observationError } = await supabase.from('fare_observations').insert(observationRows);
    if (observationError) throw new Error(`Unable to save fare observations: ${observationError.message}`);
  }

  const comparisonRows = scoredCandidates.flatMap(({ candidate }) =>
    (candidate.comparison ?? origins.map((airport) => ({
      airport,
      price: airport === candidate.origin
        ? candidate.price
        : candidates.find((other) =>
          other.origin === airport
          && other.destinationAirport === candidate.destinationAirport
          && other.outboundDate === candidate.outboundDate
          && other.returnDate === candidate.returnDate,
        )?.price ?? null,
    }))).map((comparison) => ({
      deal_id: scannedDealId(provider, candidate),
      airport: comparison.airport,
      price: comparison.price,
      checked_at: observedAt,
    })),
  );
  if (comparisonRows.length) {
    const { error: comparisonError } = await supabase
      .from('airport_comparisons')
      .upsert(comparisonRows, { onConflict: 'deal_id,airport' });
    if (comparisonError) throw new Error(`Unable to save airport comparisons: ${comparisonError.message}`);
  }

  let expiredCandidates = 0;
  if (provider.name !== 'mock') {
    const currentIds = new Set(scoredCandidates.map(({ candidate }) => scannedDealId(provider, candidate)));
    const { data: existing, error: existingError } = await supabase
      .from('deals')
      .select('id,status')
      .eq('provider', provider.name)
      .in('status', ['candidate', 'needs_review']);
    if (existingError) throw new Error(`Unable to check stale deals: ${existingError.message}`);
    const staleIds = (existing ?? []).map((deal) => deal.id as string).filter((id) => !currentIds.has(id));
    if (staleIds.length) {
      const { error: expiryError } = await supabase.from('deals').update({ status: 'expired' }).in('id', staleIds);
      if (expiryError) throw new Error(`Unable to expire stale deals: ${expiryError.message}`);
      expiredCandidates = staleIds.length;
    }
  }

  return {
    provider: provider.name,
    candidatesFound: scoredCandidates.length,
    observationsSaved: observationRows.length,
    expiredCandidates,
    completedAt: observedAt,
  };
}
