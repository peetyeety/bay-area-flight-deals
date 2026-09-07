import type { AirportCode, AirfareProvider, DealStatus, FlightDeal } from './deals';
import { createSupabaseAdmin } from './supabase/admin';

type DealRow = {
  id: string;
  provider: string;
  origin: AirportCode;
  destination_airport: string;
  destination_city: string;
  destination_country: string;
  region: FlightDeal['region'] | null;
  price: number;
  currency: string;
  typical_price: number | null;
  percent_below_typical: number | null;
  score: number;
  airline: string;
  nonstop: boolean;
  outbound_date: string | null;
  return_date: string | null;
  last_seen_at: string;
  status: DealStatus;
  booking_url: string | null;
  airport_comparisons: Array<{ airport: AirportCode; price: number | null }>;
  instagram_posts: Array<{
    id: string;
    caption: string;
    image_path: string | null;
    status: 'draft' | 'approved' | 'publishing' | 'published' | 'failed';
    created_at: string;
  }>;
};

function formatDate(value: string | null) {
  if (!value) return 'Flexible';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatSeenAgo(value: string) {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (elapsedMinutes < 60) return `${elapsedMinutes || 1} min ago`;
  const hours = Math.floor(elapsedMinutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

function mapDeal(row: DealRow): FlightDeal {
  const latestPost = [...row.instagram_posts].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];

  return {
    id: row.id,
    provider: row.provider,
    origin: row.origin,
    destinationAirport: row.destination_airport,
    destinationCity: row.destination_city,
    destinationCountry: row.destination_country,
    region: row.region ?? 'Americas',
    price: row.price,
    currency: row.currency,
    typicalPrice: row.typical_price ?? row.price,
    percentBelowTypical: Number(row.percent_below_typical ?? 0),
    score: Number(row.score),
    airline: row.airline,
    nonstop: row.nonstop,
    outboundDate: formatDate(row.outbound_date),
    returnDate: formatDate(row.return_date),
    seenAgo: formatSeenAgo(row.last_seen_at),
    comparison: [...row.airport_comparisons]
      .sort((a, b) => ['SFO', 'SJC', 'OAK'].indexOf(a.airport) - ['SFO', 'SJC', 'OAK'].indexOf(b.airport)),
    status: row.status,
    latestPost: latestPost
      ? {
          id: latestPost.id,
          caption: latestPost.caption,
          imagePath: latestPost.image_path,
          status: latestPost.status,
        }
      : undefined,
    bookingUrl: row.booking_url ?? undefined,
  };
}

const dealSelect = `
  id,
  provider,
  origin,
  destination_airport,
  destination_city,
  destination_country,
  region,
  price,
  currency,
  typical_price,
  percent_below_typical,
  score,
  airline,
  nonstop,
  outbound_date,
  return_date,
  last_seen_at,
  status,
  booking_url,
  airport_comparisons ( airport, price ),
  instagram_posts ( id, caption, image_path, status, created_at )
`;

export class SupabaseAirfareProvider implements AirfareProvider {
  readonly name = 'supabase';

  async listDeals() {
    const selectedProvider = process.env.FLIGHT_PROVIDER?.toLowerCase();
    const databaseProvider = selectedProvider === 'serpapi'
      ? 'serpapi-google-flights-deals'
      : selectedProvider === 'amadeus'
        ? `amadeus-${process.env.AMADEUS_ENV === 'production' ? 'production' : 'test'}`
        : 'mock';
    const { data, error } = await createSupabaseAdmin()
      .from('deals')
      .select(dealSelect)
      .eq('provider', databaseProvider)
      .not('status', 'in', '(rejected,expired)')
      .order('score', { ascending: false });

    if (error) throw new Error(`Unable to load deals: ${error.message}`);
    return (data as unknown as DealRow[]).map(mapDeal);
  }

  async getDeal(id: string) {
    const { data, error } = await createSupabaseAdmin()
      .from('deals')
      .select(dealSelect)
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Unable to load deal: ${error.message}`);
    return data ? mapDeal(data as unknown as DealRow) : undefined;
  }
}

export const airfareProvider: AirfareProvider = new SupabaseAirfareProvider();
