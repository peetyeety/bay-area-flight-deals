import assert from 'node:assert/strict';
import { AmadeusFlightDataProvider } from '../lib/providers/amadeus-provider.ts';
import { SerpApiFlightDataProvider } from '../lib/providers/serpapi-provider.ts';
import { scoreDeal } from '../lib/scoring.ts';
import { scannedDealId } from '../lib/scanner.ts';

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fakeFetch: typeof fetch = async (input) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url);

  if (url.pathname.endsWith('/security/oauth2/token')) {
    return json({ access_token: 'test-token', expires_in: 1_800 });
  }
  if (url.pathname.endsWith('/shopping/flight-destinations')) {
    return json({
      data: [{
        origin: 'SFO',
        destination: 'CDG',
        departureDate: '2026-11-10',
        returnDate: '2026-11-18',
        price: { total: '420.00' },
      }],
      dictionaries: {
        currencies: { USD: 'US DOLLAR' },
        locations: { CDG: { detailedName: 'Paris/FR: Charles de Gaulle', subType: 'AIRPORT' } },
      },
    });
  }
  if (url.pathname.endsWith('/shopping/flight-offers')) {
    return json({
      data: [{
        id: 'offer-1',
        price: { total: '399.00', currency: 'USD' },
        validatingAirlineCodes: ['BF'],
        itineraries: [
          { segments: [{ carrierCode: 'BF', arrival: { iataCode: 'CDG' } }] },
          { segments: [{ carrierCode: 'BF', arrival: { iataCode: 'SFO' } }] },
        ],
      }],
      dictionaries: {
        carriers: { BF: 'FRENCH BEE' },
        locations: { CDG: { cityCode: 'PAR', countryCode: 'FR' } },
      },
    });
  }
  if (url.pathname.endsWith('/analytics/itinerary-price-metrics')) {
    return json({
      data: [{ priceMetrics: [{ amount: '800.00', quartileRanking: 'MEDIUM' }] }],
    });
  }
  return json({ errors: [{ title: 'Unexpected test URL', detail: url.pathname }] }, 404);
};

const provider = new AmadeusFlightDataProvider({
  apiKey: 'key',
  apiSecret: 'secret',
  environment: 'test',
  maxDeals: 1,
}, fakeFetch);

const candidates = await provider.searchDeals(['SFO']);
assert.equal(candidates.length, 1);
assert.deepEqual(
  {
    origin: candidates[0].origin,
    destinationAirport: candidates[0].destinationAirport,
    destinationCity: candidates[0].destinationCity,
    destinationCountry: candidates[0].destinationCountry,
    price: candidates[0].price,
    typicalPrice: candidates[0].typicalPrice,
    airline: candidates[0].airline,
    nonstop: candidates[0].nonstop,
  },
  {
    origin: 'SFO',
    destinationAirport: 'CDG',
    destinationCity: 'Paris',
    destinationCountry: 'France',
    price: 399,
    typicalPrice: 800,
    airline: 'FRENCH BEE',
    nonstop: true,
  },
);

assert.deepEqual(scoreDeal({ currentPrice: 399, typicalPrice: 800, nonstop: true }), {
  typicalPrice: 800,
  percentBelowTypical: 50,
  score: 85,
});

let serpApiRequestCount = 0;
const fakeSerpApiFetch: typeof fetch = async (input) => {
  serpApiRequestCount += 1;
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input : input.url);
  const origin = url.searchParams.get('departure_id') ?? 'SFO';
  assert.equal(url.searchParams.get('engine'), 'google_flights_deals');
  assert.equal(url.searchParams.get('api_key'), 'private-key');
  return json({
    deals: [{
      destination_id: '/m/05qtj',
      name: 'Honolulu',
      country: 'United States',
      departure_airport_code: origin,
      arrival_airport_code: 'HNL',
      outbound_date: '2026-10-10',
      return_date: '2026-10-17',
      price: origin === 'OAK' ? 190 : origin === 'SJC' ? 198 : 220,
      average_price: 400,
      discount_percentage: origin === 'OAK' ? 53 : origin === 'SJC' ? 51 : 45,
      stops: 0,
      airline: 'Southwest',
      airline_code: 'WN',
      flight_link: 'https://www.google.com/travel/flights',
    }],
  });
};

const serpApiProvider = new SerpApiFlightDataProvider({ apiKey: 'private-key', maxDeals: 3, minimumDiscountPercent: 30 }, fakeSerpApiFetch);
const serpApiCandidates = await serpApiProvider.searchDeals(['SFO', 'SJC', 'OAK']);
assert.equal(serpApiRequestCount, 3);
assert.equal(serpApiCandidates.length, 3);
assert.equal(serpApiCandidates[0].origin, 'SFO');
assert.equal(serpApiCandidates[1].origin, 'SJC');
assert.equal(serpApiCandidates[2].origin, 'OAK');
assert.equal(serpApiCandidates[2].price, 190);
assert.equal(serpApiCandidates[2].typicalPrice, 400);
assert.equal(serpApiCandidates[2].percentBelowTypical, 53);
assert.equal(serpApiCandidates[2].bookingUrl, 'https://www.google.com/travel/flights');
assert.match(serpApiCandidates[0].providerReference, /\/m\//);
assert.doesNotMatch(scannedDealId(serpApiProvider, serpApiCandidates[0]), /\//);

console.log('Scanner tests passed: provider normalization, three-airport discovery, and deal scoring are working.');
