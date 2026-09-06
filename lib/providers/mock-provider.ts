import { deals, type AirportCode } from '../deals.ts';
import type { FareCandidate, FlightDataProvider } from './types.ts';

function isoDate(displayDate: string) {
  const month = displayDate.split(' ')[0];
  const year = ['Jan', 'Feb', 'Mar'].includes(month) ? 2027 : 2026;
  return new Date(`${displayDate}, ${year} 12:00:00 UTC`).toISOString().slice(0, 10);
}

export class MockFlightDataProvider implements FlightDataProvider {
  readonly name = 'mock';

  async searchDeals(origins: AirportCode[]) {
    return deals.filter((deal) => origins.includes(deal.origin)).map((deal): FareCandidate => ({
      databaseId: deal.id,
      providerReference: deal.id,
      origin: deal.origin,
      destinationAirport: deal.destinationAirport,
      destinationCity: deal.destinationCity,
      destinationCountry: deal.destinationCountry,
      region: deal.region,
      price: deal.price,
      currency: 'USD',
      typicalPrice: deal.typicalPrice,
      percentBelowTypical: deal.percentBelowTypical,
      score: deal.score,
      airline: deal.airline,
      nonstop: deal.nonstop,
      outboundDate: isoDate(deal.outboundDate),
      returnDate: isoDate(deal.returnDate),
      comparison: deal.comparison,
      rawPayload: deal,
    }));
  }
}

export const mockFlightDataProvider = new MockFlightDataProvider();
