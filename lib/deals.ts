export type AirportCode = 'SFO' | 'SJC' | 'OAK';

export type AirportComparison = {
  airport: AirportCode;
  price: number | null;
};

export type DealStatus =
  | 'candidate'
  | 'needs_review'
  | 'verified'
  | 'rejected'
  | 'post_generated'
  | 'published'
  | 'expired';

export type InstagramPostDraft = {
  id: string;
  caption: string;
  imagePath: string | null;
  status: 'draft' | 'approved' | 'publishing' | 'published' | 'failed';
};

export type FlightDeal = {
  id: string;
  provider?: string;
  origin: AirportCode;
  destinationAirport: string;
  destinationCity: string;
  destinationCountry: string;
  region: 'Asia' | 'Europe' | 'Americas' | 'Oceania';
  price: number;
  currency?: string;
  typicalPrice: number;
  percentBelowTypical: number;
  score: number;
  airline: string;
  nonstop: boolean;
  outboundDate: string;
  returnDate: string;
  seenAgo: string;
  comparison: AirportComparison[];
  status?: DealStatus;
  latestPost?: InstagramPostDraft;
  bookingUrl?: string;
};

export interface AirfareProvider {
  readonly name: string;
  listDeals(): Promise<FlightDeal[]>;
  getDeal(id: string): Promise<FlightDeal | undefined>;
}

export const deals: FlightDeal[] = [
  {
    id: 'sfo-tokyo', origin: 'SFO', destinationAirport: 'NRT', destinationCity: 'Tokyo', destinationCountry: 'Japan', region: 'Asia', price: 387, typicalPrice: 717, percentBelowTypical: 46, score: 91, airline: 'ZIPAIR', nonstop: true, outboundDate: 'Nov 4', returnDate: 'Nov 11', seenAgo: '12 min ago',
    comparison: [{ airport: 'SFO', price: 387 }, { airport: 'SJC', price: 611 }, { airport: 'OAK', price: null }],
  },
  {
    id: 'sjc-honolulu', origin: 'SJC', destinationAirport: 'HNL', destinationCity: 'Honolulu', destinationCountry: 'United States', region: 'Americas', price: 198, typicalPrice: 382, percentBelowTypical: 48, score: 94, airline: 'Southwest', nonstop: true, outboundDate: 'Oct 10', returnDate: 'Oct 14', seenAgo: '8 min ago',
    comparison: [{ airport: 'SFO', price: 244 }, { airport: 'SJC', price: 198 }, { airport: 'OAK', price: 219 }],
  },
  {
    id: 'oak-las-vegas', origin: 'OAK', destinationAirport: 'LAS', destinationCity: 'Las Vegas', destinationCountry: 'United States', region: 'Americas', price: 67, typicalPrice: 149, percentBelowTypical: 55, score: 93, airline: 'Spirit', nonstop: true, outboundDate: 'Sep 24', returnDate: 'Sep 28', seenAgo: '18 min ago',
    comparison: [{ airport: 'SFO', price: 109 }, { airport: 'SJC', price: 94 }, { airport: 'OAK', price: 67 }],
  },
  {
    id: 'sfo-lisbon', origin: 'SFO', destinationAirport: 'LIS', destinationCity: 'Lisbon', destinationCountry: 'Portugal', region: 'Europe', price: 436, typicalPrice: 812, percentBelowTypical: 46, score: 89, airline: 'TAP Air Portugal', nonstop: true, outboundDate: 'Jan 19', returnDate: 'Jan 28', seenAgo: '24 min ago',
    comparison: [{ airport: 'SFO', price: 436 }, { airport: 'SJC', price: 578 }, { airport: 'OAK', price: null }],
  },
  {
    id: 'sfo-sydney', origin: 'SFO', destinationAirport: 'SYD', destinationCity: 'Sydney', destinationCountry: 'Australia', region: 'Oceania', price: 623, typicalPrice: 1089, percentBelowTypical: 43, score: 88, airline: 'United', nonstop: true, outboundDate: 'Feb 3', returnDate: 'Feb 14', seenAgo: '31 min ago',
    comparison: [{ airport: 'SFO', price: 623 }, { airport: 'SJC', price: 801 }, { airport: 'OAK', price: null }],
  },
  {
    id: 'oak-mexico-city', origin: 'OAK', destinationAirport: 'MEX', destinationCity: 'Mexico City', destinationCountry: 'Mexico', region: 'Americas', price: 221, typicalPrice: 389, percentBelowTypical: 43, score: 87, airline: 'Volaris', nonstop: true, outboundDate: 'Oct 7', returnDate: 'Oct 13', seenAgo: '42 min ago',
    comparison: [{ airport: 'SFO', price: 268 }, { airport: 'SJC', price: 244 }, { airport: 'OAK', price: 221 }],
  },
  {
    id: 'sfo-barcelona', origin: 'SFO', destinationAirport: 'BCN', destinationCity: 'Barcelona', destinationCountry: 'Spain', region: 'Europe', price: 449, typicalPrice: 777, percentBelowTypical: 42, score: 86, airline: 'Level', nonstop: true, outboundDate: 'Nov 17', returnDate: 'Nov 26', seenAgo: '49 min ago',
    comparison: [{ airport: 'SFO', price: 449 }, { airport: 'SJC', price: 619 }, { airport: 'OAK', price: null }],
  },
  {
    id: 'sjc-vancouver', origin: 'SJC', destinationAirport: 'YVR', destinationCity: 'Vancouver', destinationCountry: 'Canada', region: 'Americas', price: 174, typicalPrice: 289, percentBelowTypical: 40, score: 84, airline: 'Air Canada', nonstop: true, outboundDate: 'Oct 18', returnDate: 'Oct 22', seenAgo: '1 hr ago',
    comparison: [{ airport: 'SFO', price: 193 }, { airport: 'SJC', price: 174 }, { airport: 'OAK', price: 238 }],
  },
  {
    id: 'sfo-paris', origin: 'SFO', destinationAirport: 'CDG', destinationCity: 'Paris', destinationCountry: 'France', region: 'Europe', price: 479, typicalPrice: 784, percentBelowTypical: 39, score: 82, airline: 'French bee', nonstop: true, outboundDate: 'Dec 2', returnDate: 'Dec 10', seenAgo: '1 hr ago',
    comparison: [{ airport: 'SFO', price: 479 }, { airport: 'SJC', price: 655 }, { airport: 'OAK', price: null }],
  },
  {
    id: 'oak-new-york', origin: 'OAK', destinationAirport: 'JFK', destinationCity: 'New York', destinationCountry: 'United States', region: 'Americas', price: 178, typicalPrice: 281, percentBelowTypical: 37, score: 79, airline: 'JetBlue', nonstop: false, outboundDate: 'Sep 30', returnDate: 'Oct 5', seenAgo: '2 hrs ago',
    comparison: [{ airport: 'SFO', price: 205 }, { airport: 'SJC', price: 231 }, { airport: 'OAK', price: 178 }],
  },
  {
    id: 'sfo-seoul', origin: 'SFO', destinationAirport: 'ICN', destinationCity: 'Seoul', destinationCountry: 'South Korea', region: 'Asia', price: 522, typicalPrice: 795, percentBelowTypical: 34, score: 76, airline: 'Air Premia', nonstop: true, outboundDate: 'Mar 8', returnDate: 'Mar 18', seenAgo: '2 hrs ago',
    comparison: [{ airport: 'SFO', price: 522 }, { airport: 'SJC', price: 698 }, { airport: 'OAK', price: null }],
  },
  {
    id: 'sjc-portland', origin: 'SJC', destinationAirport: 'PDX', destinationCity: 'Portland', destinationCountry: 'United States', region: 'Americas', price: 97, typicalPrice: 142, percentBelowTypical: 32, score: 73, airline: 'Alaska', nonstop: true, outboundDate: 'Oct 4', returnDate: 'Oct 6', seenAgo: '3 hrs ago',
    comparison: [{ airport: 'SFO', price: 119 }, { airport: 'SJC', price: 97 }, { airport: 'OAK', price: 126 }],
  },
];

export class MockAirfareProvider implements AirfareProvider {
  readonly name = 'mock';

  async listDeals() {
    return deals;
  }

  async getDeal(id: string) {
    return deals.find((deal) => deal.id === id);
  }
}
