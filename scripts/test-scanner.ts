import assert from 'node:assert/strict';
import { AmadeusFlightDataProvider } from '../lib/providers/amadeus-provider.ts';
import { scoreDeal } from '../lib/scoring.ts';

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

console.log('Scanner tests passed: Amadeus normalization and deal scoring are working.');
