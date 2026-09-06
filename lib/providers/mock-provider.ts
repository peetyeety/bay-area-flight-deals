import { deals, type AirportCode, type FlightDeal } from '../deals.ts';

export interface FlightDataProvider {
  readonly name: string;
  searchDeals(origins: AirportCode[]): Promise<FlightDeal[]>;
}

export class MockFlightDataProvider implements FlightDataProvider {
  readonly name = 'mock';

  async searchDeals(origins: AirportCode[]) {
    return deals.filter((deal) => origins.includes(deal.origin));
  }
}

export const mockFlightDataProvider = new MockFlightDataProvider();
