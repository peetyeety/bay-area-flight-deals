import type { AirportCode, FlightDeal } from '../deals.ts';
import type { FareCandidate, FlightDataProvider } from './types.ts';

type SerpApiDestination = {
  destination_id?: string;
  name?: string;
  country?: string;
  destination_airport?: { code?: string; location?: string; name?: string };
  start_date?: string;
  end_date?: string;
  flight_price?: number;
  number_of_stops?: number;
  airline?: string;
  airline_code?: string;
  link?: string;
};

type SerpApiResponse = {
  destinations?: SerpApiDestination[];
  error?: string;
  search_metadata?: { status?: string };
};

type SerpApiConfig = {
  apiKey: string;
  maxDeals: number;
  maxPrice?: number;
};

const asiaCountries = new Set([
  'China', 'Hong Kong', 'India', 'Indonesia', 'Israel', 'Japan', 'Malaysia', 'Philippines',
  'Qatar', 'Singapore', 'South Korea', 'Taiwan', 'Thailand', 'Turkey', 'United Arab Emirates', 'Vietnam',
]);
const europeCountries = new Set([
  'Austria', 'Belgium', 'Croatia', 'Czechia', 'Denmark', 'Finland', 'France', 'Germany', 'Greece',
  'Hungary', 'Iceland', 'Ireland', 'Italy', 'Netherlands', 'Norway', 'Poland', 'Portugal', 'Romania',
  'Spain', 'Sweden', 'Switzerland', 'United Kingdom',
]);
const oceaniaCountries = new Set(['Australia', 'Fiji', 'New Zealand']);

function regionFor(country: string): FlightDeal['region'] {
  if (asiaCountries.has(country)) return 'Asia';
  if (europeCountries.has(country)) return 'Europe';
  if (oceaniaCountries.has(country)) return 'Oceania';
  return 'Americas';
}

function isCompleteDestination(value: SerpApiDestination): value is SerpApiDestination & {
  name: string;
  country: string;
  destination_airport: { code: string };
  start_date: string;
  end_date: string;
  flight_price: number;
} {
  return Boolean(
    value.name
    && value.country
    && value.destination_airport?.code
    && value.start_date
    && value.end_date
    && Number.isFinite(value.flight_price)
    && Number(value.flight_price) > 0,
  );
}

export class SerpApiFlightDataProvider implements FlightDataProvider {
  readonly name = 'serpapi-google-travel';
  private readonly config: SerpApiConfig;
  private readonly fetcher: typeof fetch;

  constructor(config: SerpApiConfig, fetcher: typeof fetch = fetch) {
    this.config = config;
    this.fetcher = fetcher;
  }

  private async discover(origin: AirportCode) {
    const params: Record<string, string> = {
      engine: 'google_travel_explore',
      departure_id: origin,
      currency: 'USD',
      gl: 'us',
      hl: 'en',
      type: '1',
      month: '0',
      travel_duration: '2',
      travel_mode: '1',
      api_key: this.config.apiKey,
    };
    if (this.config.maxPrice) params.max_price = String(this.config.maxPrice);

    const response = await this.fetcher(`https://serpapi.com/search.json?${new URLSearchParams(params)}`);
    const payload = await response.json() as SerpApiResponse;
    if (!response.ok || payload.error) {
      throw new Error(payload.error || `SerpApi request failed with HTTP ${response.status}.`);
    }

    return (payload.destinations ?? [])
      .filter(isCompleteDestination)
      .map((destination): FareCandidate => ({
        providerReference: `${origin}-${destination.destination_id ?? destination.destination_airport.code}-${destination.start_date}-${destination.end_date}`,
        origin,
        destinationAirport: destination.destination_airport.code,
        destinationCity: destination.name,
        destinationCountry: destination.country,
        region: regionFor(destination.country),
        price: Math.round(destination.flight_price),
        currency: 'USD',
        airline: destination.airline ?? destination.airline_code ?? 'Carrier not confirmed',
        nonstop: destination.number_of_stops === 0,
        outboundDate: destination.start_date,
        returnDate: destination.end_date,
        bookingUrl: destination.link,
        rawPayload: destination,
      }));
  }

  async searchDeals(origins: AirportCode[]) {
    // One Explore request per Bay Area origin: three API credits per complete scan.
    const results = await Promise.allSettled(origins.map(async (origin) => ({ origin, candidates: await this.discover(origin) })));
    const successful = results
      .filter((result): result is PromiseFulfilledResult<{ origin: AirportCode; candidates: FareCandidate[] }> => result.status === 'fulfilled');
    const allCandidates = successful.flatMap(({ value }) => value.candidates);

    if (!allCandidates.length) {
      const failures = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));
      throw new Error(`SerpApi returned no flight candidates${failures.length ? `: ${failures.join(' | ')}` : '.'}`);
    }

    const sorted = [...allCandidates].sort((a, b) => a.price - b.price);
    const selected: FareCandidate[] = [];
    for (const origin of origins) {
      const firstForOrigin = sorted.find((candidate) => candidate.origin === origin);
      if (firstForOrigin) selected.push(firstForOrigin);
    }
    for (const candidate of sorted) {
      if (selected.length >= this.config.maxDeals) break;
      if (!selected.includes(candidate)) selected.push(candidate);
    }
    return selected.slice(0, this.config.maxDeals);
  }
}

export function createSerpApiProviderFromEnvironment() {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    throw new Error('Live scanning needs SERPAPI_API_KEY. Add it to .env.local (and Vercel for the online dashboard).');
  }
  return new SerpApiFlightDataProvider({
    apiKey,
    maxDeals: Math.max(1, Math.min(30, Number(process.env.SERPAPI_MAX_DEALS ?? 12))),
    maxPrice: process.env.SERPAPI_MAX_PRICE ? Number(process.env.SERPAPI_MAX_PRICE) : undefined,
  });
}
