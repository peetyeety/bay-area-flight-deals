import { INTERNATIONAL_FOCUS_COUNTRIES, dealCategoryFor, type AirportCode, type FlightDeal } from '../deals.ts';
import type { FareCandidate, FlightDataProvider } from './types.ts';

type SerpApiDeal = {
  destination_id?: string;
  name?: string;
  country?: string;
  departure_airport_code?: string;
  arrival_airport_code?: string;
  outbound_date?: string;
  return_date?: string;
  start_date?: string;
  end_date?: string;
  price?: number;
  average_price?: number;
  discount_percentage?: number;
  stops?: number;
  airline?: string;
  airline_code?: string;
  flight_link?: string;
};

type SerpApiResponse = {
  deals?: SerpApiDeal[];
  error?: string;
};

type SerpApiConfig = {
  apiKey: string;
  maxDeals: number;
  maxPrice?: number;
  minimumDiscountPercent: number;
};

type SearchKind = 'weekend' | 'international';

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

function isCompleteDeal(value: SerpApiDeal): value is SerpApiDeal & {
  name: string;
  country: string;
  departure_airport_code: AirportCode;
  arrival_airport_code: string;
  price: number;
  average_price: number;
  discount_percentage: number;
} {
  return Boolean(
    value.name
    && value.country
    && value.departure_airport_code
    && value.arrival_airport_code
    && (value.outbound_date || value.start_date)
    && (value.return_date || value.end_date)
    && Number.isFinite(value.price)
    && Number(value.price) > 0
    && Number.isFinite(value.average_price)
    && Number(value.average_price) > 0
    && Number.isFinite(value.discount_percentage),
  );
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function searchWindow(kind: SearchKind) {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + (kind === 'weekend' ? 5 : 14));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + (kind === 'weekend' ? 120 : 210));
  return `${isoDate(start)},${isoDate(end)}`;
}

export class SerpApiFlightDataProvider implements FlightDataProvider {
  readonly name = 'serpapi-google-flights-deals';
  private readonly config: SerpApiConfig;
  private readonly fetcher: typeof fetch;

  constructor(config: SerpApiConfig, fetcher: typeof fetch = fetch) {
    this.config = config;
    this.fetcher = fetcher;
  }

  private async discover(origin: AirportCode, kind: SearchKind) {
    const params: Record<string, string> = {
      engine: 'google_flights_deals',
      departure_id: origin,
      currency: 'USD',
      gl: 'us',
      hl: 'en',
      type: '1',
      outbound_date: searchWindow(kind),
      api_key: this.config.apiKey,
    };
    if (kind === 'weekend') params.travel_duration = '2';
    if (kind === 'international') params.trip_length = '5,14';
    if (this.config.maxPrice) params.max_price = String(this.config.maxPrice);

    const response = await this.fetcher(`https://serpapi.com/search.json?${new URLSearchParams(params)}`);
    const payload = await response.json() as SerpApiResponse;
    if (!response.ok || payload.error) {
      throw new Error(payload.error || `SerpApi request failed with HTTP ${response.status}.`);
    }

    return (payload.deals ?? [])
      .filter(isCompleteDeal)
      .filter((deal) => {
        const outboundDate = deal.outbound_date ?? deal.start_date;
        const returnDate = deal.return_date ?? deal.end_date;
        if (kind === 'weekend') {
          return deal.country === 'United States'
            && dealCategoryFor(deal.country, outboundDate, returnDate) === 'weekend_getaway';
        }
        return INTERNATIONAL_FOCUS_COUNTRIES.has(deal.country);
      })
      .filter((deal) => deal.discount_percentage >= this.config.minimumDiscountPercent)
      .map((deal): FareCandidate => {
        const outboundDate = deal.outbound_date ?? deal.start_date ?? '';
        const returnDate = deal.return_date ?? deal.end_date ?? '';
        return {
          providerReference: `${deal.departure_airport_code}-${deal.destination_id ?? deal.arrival_airport_code}-${outboundDate}-${returnDate}`,
          origin: deal.departure_airport_code,
          destinationAirport: deal.arrival_airport_code,
          destinationCity: deal.name,
          destinationCountry: deal.country,
          region: regionFor(deal.country),
          price: Math.round(deal.price),
          currency: 'USD',
          typicalPrice: Math.round(deal.average_price),
          percentBelowTypical: Math.round(deal.discount_percentage),
          airline: deal.airline ?? deal.airline_code ?? 'Carrier not confirmed',
          nonstop: deal.stops === 0,
          outboundDate,
          returnDate,
          bookingUrl: deal.flight_link,
          rawPayload: deal,
        };
      });
  }

  async searchDeals(origins: AirportCode[]) {
    // Two focused Deals requests per origin: six API credits per complete scan.
    // Fail the whole scan if an origin fails so stale-expiry remains safe.
    const results = await Promise.all(origins.flatMap((origin) => [
      this.discover(origin, 'weekend'),
      this.discover(origin, 'international'),
    ]));
    const allCandidates = results.flat();
    const sorted = [...allCandidates].sort((a, b) =>
      (b.percentBelowTypical ?? 0) - (a.percentBelowTypical ?? 0) || a.price - b.price,
    );
    const selected: FareCandidate[] = [];
    for (const kind of ['weekend_getaway', 'international'] as const) {
      for (const origin of origins) {
        const firstForOrigin = sorted.find((candidate) =>
          candidate.origin === origin
          && dealCategoryFor(candidate.destinationCountry, candidate.outboundDate, candidate.returnDate) === kind,
        );
        if (firstForOrigin && !selected.includes(firstForOrigin)) selected.push(firstForOrigin);
      }
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
    maxDeals: Math.max(1, Math.min(100, Number(process.env.SERPAPI_MAX_DEALS ?? 50))),
    maxPrice: process.env.SERPAPI_MAX_PRICE ? Number(process.env.SERPAPI_MAX_PRICE) : undefined,
    minimumDiscountPercent: Math.max(0, Math.min(100, Number(process.env.DEAL_MIN_DISCOUNT_PERCENT ?? 30))),
  });
}
