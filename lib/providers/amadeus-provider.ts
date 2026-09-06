import type { AirportCode, FlightDeal } from '../deals.ts';
import type { FareCandidate, FlightDataProvider } from './types.ts';

type Fetch = typeof fetch;

type AmadeusError = {
  errors?: Array<{ title?: string; detail?: string; code?: number }>;
};

type InspirationItem = {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  price: { total: string };
  links?: { flightOffers?: string };
};

type InspirationResponse = AmadeusError & {
  data?: InspirationItem[];
  dictionaries?: {
    currencies?: Record<string, string>;
    locations?: Record<string, { detailedName?: string; subType?: string }>;
  };
};

type FlightOffer = {
  id: string;
  price: { total: string; currency: string };
  itineraries: Array<{
    segments: Array<{
      carrierCode: string;
      arrival: { iataCode: string };
    }>;
  }>;
  validatingAirlineCodes?: string[];
};

type OffersResponse = AmadeusError & {
  data?: FlightOffer[];
  dictionaries?: {
    carriers?: Record<string, string>;
    locations?: Record<string, { cityCode?: string; countryCode?: string }>;
  };
};

type PriceMetricsResponse = AmadeusError & {
  data?: Array<{
    priceMetrics?: Array<{ amount: string; quartileRanking: string }>;
  }>;
};

type AmadeusProviderConfig = {
  apiKey: string;
  apiSecret: string;
  environment: 'test' | 'production';
  maxDeals: number;
  maxPrice?: number;
};

const countryNames = new Intl.DisplayNames(['en'], { type: 'region' });

const asia = new Set(['AE', 'CN', 'HK', 'ID', 'IL', 'IN', 'JP', 'KR', 'MY', 'PH', 'QA', 'SG', 'TH', 'TW', 'VN']);
const europe = new Set(['AT', 'BE', 'CH', 'CZ', 'DE', 'DK', 'ES', 'FI', 'FR', 'GB', 'GR', 'HR', 'HU', 'IE', 'IS', 'IT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SE', 'TR']);
const oceania = new Set(['AU', 'FJ', 'NZ']);

function regionFor(countryCode?: string): FlightDeal['region'] {
  if (countryCode && asia.has(countryCode)) return 'Asia';
  if (countryCode && europe.has(countryCode)) return 'Europe';
  if (countryCode && oceania.has(countryCode)) return 'Oceania';
  return 'Americas';
}

function parseDetailedName(value: string | undefined, fallback: string) {
  if (!value) return { city: fallback, countryCode: undefined };
  const [place, rest] = value.split('/');
  return {
    city: place?.trim() || fallback,
    countryCode: rest?.split(':')[0]?.trim().toUpperCase() || undefined,
  };
}

function integerPrice(value: string | undefined) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? Math.round(price) : undefined;
}

function errorMessage(payload: AmadeusError, status: number) {
  const issue = payload.errors?.[0];
  return [issue?.title, issue?.detail].filter(Boolean).join(': ') || `HTTP ${status}`;
}

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return result.toISOString().slice(0, 10);
}

function googleFlightsUrl(candidate: Pick<FareCandidate, 'origin' | 'destinationAirport' | 'outboundDate' | 'returnDate'>) {
  const query = `Flights from ${candidate.origin} to ${candidate.destinationAirport} ${candidate.outboundDate} return ${candidate.returnDate}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`;
}

export class AmadeusFlightDataProvider implements FlightDataProvider {
  readonly name: string;
  private accessToken?: { value: string; expiresAt: number };
  private readonly baseUrl: string;
  private readonly config: AmadeusProviderConfig;
  private readonly fetcher: Fetch;

  constructor(config: AmadeusProviderConfig, fetcher: Fetch = fetch) {
    this.config = config;
    this.fetcher = fetcher;
    this.name = `amadeus-${config.environment}`;
    this.baseUrl = config.environment === 'production' ? 'https://api.amadeus.com' : 'https://test.api.amadeus.com';
  }

  private async token() {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 30_000) return this.accessToken.value;

    const response = await this.fetcher(`${this.baseUrl}/v1/security/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.apiKey,
        client_secret: this.config.apiSecret,
      }),
    });
    const payload = await response.json() as AmadeusError & { access_token?: string; expires_in?: number };
    if (!response.ok || !payload.access_token) {
      throw new Error(`Amadeus sign-in failed: ${errorMessage(payload, response.status)}. Check AMADEUS_API_KEY and AMADEUS_API_SECRET.`);
    }

    this.accessToken = {
      value: payload.access_token,
      expiresAt: Date.now() + (payload.expires_in ?? 1_700) * 1_000,
    };
    return payload.access_token;
  }

  private async get<T extends AmadeusError>(path: string, params: Record<string, string>) {
    const response = await this.fetcher(`${this.baseUrl}${path}?${new URLSearchParams(params)}`, {
      headers: { Authorization: `Bearer ${await this.token()}` },
    });
    const payload = await response.json() as T;
    if (!response.ok) throw new Error(errorMessage(payload, response.status));
    return payload;
  }

  private async discover(origin: AirportCode) {
    const today = new Date();
    const params: Record<string, string> = {
      origin,
      departureDate: `${addDays(today, 14)},${addDays(today, 150)}`,
      duration: '3,14',
      oneWay: 'false',
      nonStop: 'false',
      viewBy: 'DESTINATION',
    };
    if (this.config.maxPrice) params.maxPrice = String(this.config.maxPrice);
    return this.get<InspirationResponse>('/v1/shopping/flight-destinations', params);
  }

  private async offers(item: InspirationItem) {
    return this.get<OffersResponse>('/v2/shopping/flight-offers', {
      originLocationCode: item.origin,
      destinationLocationCode: item.destination,
      departureDate: item.departureDate,
      returnDate: item.returnDate,
      adults: '1',
      currencyCode: 'USD',
      max: '3',
    });
  }

  private async typicalPrice(item: InspirationItem) {
    try {
      const response = await this.get<PriceMetricsResponse>('/v1/analytics/itinerary-price-metrics', {
        originIataCode: item.origin,
        destinationIataCode: item.destination,
        departureDate: item.departureDate,
        currencyCode: 'USD',
        oneWay: 'false',
      });
      const metrics = response.data?.[0]?.priceMetrics ?? [];
      return integerPrice(metrics.find((metric) => metric.quartileRanking === 'MEDIUM')?.amount);
    } catch {
      return undefined;
    }
  }

  private async normalize(item: InspirationItem, inspiration: InspirationResponse): Promise<FareCandidate | undefined> {
    let offers: OffersResponse | undefined;
    try {
      offers = await this.offers(item);
    } catch {
      // Inspiration Search is cached discovery data. If live offer lookup fails,
      // keep it as a review candidate and make that uncertainty visible.
    }

    const cheapest = offers?.data
      ?.filter((offer) => integerPrice(offer.price.total))
      .sort((a, b) => Number(a.price.total) - Number(b.price.total))[0];
    const discoveryPrice = integerPrice(item.price.total);
    const price = integerPrice(cheapest?.price.total) ?? discoveryPrice;
    if (!price) return undefined;

    const outbound = cheapest?.itineraries[0];
    const outboundSegments = outbound?.segments ?? [];
    const lastArrival = outboundSegments.at(-1)?.arrival.iataCode;
    const destinationAirport = lastArrival ?? item.destination;
    const offerLocation = offers?.dictionaries?.locations?.[destinationAirport];
    const inspirationLocation = inspiration.dictionaries?.locations?.[item.destination];
    const parsedLocation = parseDetailedName(inspirationLocation?.detailedName, offerLocation?.cityCode ?? item.destination);
    const countryCode = offerLocation?.countryCode ?? parsedLocation.countryCode;
    const carrierCode = cheapest?.validatingAirlineCodes?.[0] ?? outboundSegments[0]?.carrierCode;
    const airline = carrierCode ? (offers?.dictionaries?.carriers?.[carrierCode] ?? carrierCode) : 'Carrier not confirmed';
    const nonstop = cheapest
      ? cheapest.itineraries.every((itinerary) => itinerary.segments.length === 1)
      : false;
    const candidate: FareCandidate = {
      providerReference: `${item.origin}-${item.destination}-${item.departureDate}-${item.returnDate}`,
      origin: item.origin as AirportCode,
      destinationAirport,
      destinationCity: parsedLocation.city,
      destinationCountry: countryCode ? (countryNames.of(countryCode) ?? countryCode) : 'Country not identified',
      region: regionFor(countryCode),
      price,
      currency: cheapest?.price.currency ?? Object.keys(inspiration.dictionaries?.currencies ?? {})[0] ?? 'USD',
      typicalPrice: await this.typicalPrice(item),
      airline,
      nonstop,
      outboundDate: item.departureDate,
      returnDate: item.returnDate,
      rawPayload: { inspiration: item, liveOffer: cheapest ?? null },
    };
    candidate.bookingUrl = googleFlightsUrl(candidate);
    return candidate;
  }

  async searchDeals(origins: AirportCode[]) {
    const discoveries = await Promise.allSettled(origins.map(async (origin) => ({ origin, response: await this.discover(origin) })));
    const successful = discoveries
      .filter((result): result is PromiseFulfilledResult<{ origin: AirportCode; response: InspirationResponse }> => result.status === 'fulfilled');
    const items = successful.flatMap(({ value }) =>
      (value.response.data ?? []).map((item) => ({ item, response: value.response })),
    );

    if (!items.length) {
      const failures = discoveries
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => result.reason instanceof Error ? result.reason.message : String(result.reason));
      throw new Error(`Amadeus returned no flight candidates${failures.length ? `: ${failures.join(' | ')}` : '.'}`);
    }

    // Preserve coverage across SFO, SJC, and OAK before filling remaining slots.
    const sorted = [...items].sort((a, b) => Number(a.item.price.total) - Number(b.item.price.total));
    const selected: typeof sorted = [];
    for (const origin of origins) {
      const firstForOrigin = sorted.find((entry) => entry.item.origin === origin);
      if (firstForOrigin) selected.push(firstForOrigin);
    }
    for (const entry of sorted) {
      if (selected.length >= this.config.maxDeals) break;
      if (!selected.includes(entry)) selected.push(entry);
    }

    const normalized: FareCandidate[] = [];
    for (const entry of selected.slice(0, this.config.maxDeals)) {
      const candidate = await this.normalize(entry.item, entry.response);
      if (candidate) normalized.push(candidate);
    }
    return normalized;
  }
}

export function createAmadeusProviderFromEnvironment() {
  const apiKey = process.env.AMADEUS_API_KEY;
  const apiSecret = process.env.AMADEUS_API_SECRET;
  if (!apiKey || !apiSecret) {
    throw new Error('Live scanning needs AMADEUS_API_KEY and AMADEUS_API_SECRET. Add both to .env.local (and Vercel for the online dashboard).');
  }
  const environment = process.env.AMADEUS_ENV === 'production' ? 'production' : 'test';
  return new AmadeusFlightDataProvider({
    apiKey,
    apiSecret,
    environment,
    maxDeals: Math.max(1, Math.min(30, Number(process.env.AMADEUS_MAX_DEALS ?? 12))),
    maxPrice: process.env.AMADEUS_MAX_PRICE ? Number(process.env.AMADEUS_MAX_PRICE) : undefined,
  });
}
