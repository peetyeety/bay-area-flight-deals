import type { AirportCode, AirportComparison, FlightDeal } from '../deals.ts';

export type FareCandidate = {
  databaseId?: string;
  providerReference: string;
  origin: AirportCode;
  destinationAirport: string;
  destinationCity: string;
  destinationCountry: string;
  region: FlightDeal['region'];
  price: number;
  currency: string;
  typicalPrice?: number;
  percentBelowTypical?: number;
  score?: number;
  airline?: string;
  nonstop?: boolean;
  outboundDate: string;
  returnDate: string;
  bookingUrl?: string;
  comparison?: AirportComparison[];
  rawPayload?: unknown;
};

export interface FlightDataProvider {
  readonly name: string;
  searchDeals(origins: AirportCode[]): Promise<FareCandidate[]>;
}
