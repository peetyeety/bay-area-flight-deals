import { dealCategoryFor, type AirportCode, type DealCategory, type FlightDeal } from './deals';
import { createSupabaseAdmin } from './supabase/admin';

export type PublicFlightDeal = {
  id: string;
  origin: AirportCode;
  destinationAirport: string;
  destinationCity: string;
  destinationCountry: string;
  region: FlightDeal['region'];
  price: number;
  currency: string;
  typicalPrice: number;
  percentBelowTypical: number;
  airline: string;
  nonstop: boolean;
  outboundDate: string | null;
  returnDate: string | null;
  lastSeenAt: string;
  bookingUrl: string | null;
  category: DealCategory;
};

type PublicDealRow = {
  id: string;
  origin: AirportCode;
  destination_airport: string;
  destination_city: string;
  destination_country: string;
  region: FlightDeal['region'] | null;
  price: number;
  currency: string;
  typical_price: number | null;
  percent_below_typical: number | null;
  airline: string;
  nonstop: boolean;
  outbound_date: string | null;
  return_date: string | null;
  last_seen_at: string;
  booking_url: string | null;
};

const PUBLIC_STATUSES = ['verified', 'post_generated', 'published'];
const FRESH_FOR_MS = 24 * 60 * 60 * 1000;

function configuredDatabaseProvider() {
  const selectedProvider = process.env.FLIGHT_PROVIDER?.toLowerCase();
  if (selectedProvider === 'serpapi') return 'serpapi-google-flights-deals';
  if (selectedProvider === 'amadeus') {
    return `amadeus-${process.env.AMADEUS_ENV === 'production' ? 'production' : 'test'}`;
  }
  return 'mock';
}

function safeBookingUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function listPublicDeals(): Promise<PublicFlightDeal[]> {
  const freshSince = new Date(Date.now() - FRESH_FOR_MS).toISOString();
  const { data, error } = await createSupabaseAdmin()
    .from('deals')
    .select(`
      id,
      origin,
      destination_airport,
      destination_city,
      destination_country,
      region,
      price,
      currency,
      typical_price,
      percent_below_typical,
      airline,
      nonstop,
      outbound_date,
      return_date,
      last_seen_at,
      booking_url
    `)
    .eq('provider', configuredDatabaseProvider())
    .in('status', PUBLIC_STATUSES)
    .gte('last_seen_at', freshSince)
    .order('percent_below_typical', { ascending: false })
    .limit(50);

  if (error) throw new Error(`Unable to load public flight deals: ${error.message}`);

  return (data as PublicDealRow[]).map((row) => ({
    id: row.id,
    origin: row.origin,
    destinationAirport: row.destination_airport,
    destinationCity: row.destination_city,
    destinationCountry: row.destination_country,
    region: row.region ?? 'Americas',
    price: row.price,
    currency: row.currency,
    typicalPrice: row.typical_price ?? row.price,
    percentBelowTypical: Number(row.percent_below_typical ?? 0),
    airline: row.airline,
    nonstop: row.nonstop,
    outboundDate: row.outbound_date,
    returnDate: row.return_date,
    lastSeenAt: row.last_seen_at,
    bookingUrl: safeBookingUrl(row.booking_url),
    category: dealCategoryFor(row.destination_country, row.outbound_date, row.return_date),
  }));
}
