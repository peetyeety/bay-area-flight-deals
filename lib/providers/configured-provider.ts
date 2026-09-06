import { createAmadeusProviderFromEnvironment } from './amadeus-provider.ts';
import { mockFlightDataProvider } from './mock-provider.ts';
import { createSerpApiProviderFromEnvironment } from './serpapi-provider.ts';
import type { FlightDataProvider } from './types.ts';

export type FlightProviderName = 'mock' | 'amadeus' | 'serpapi';

export function configuredFlightProviderName(): FlightProviderName {
  const provider = process.env.FLIGHT_PROVIDER?.toLowerCase();
  if (provider === 'serpapi') return 'serpapi';
  if (provider === 'amadeus') return 'amadeus';
  return 'mock';
}

export function configuredFlightProvider(): FlightDataProvider {
  const provider = configuredFlightProviderName();
  if (provider === 'serpapi') return createSerpApiProviderFromEnvironment();
  if (provider === 'amadeus') return createAmadeusProviderFromEnvironment();
  return mockFlightDataProvider;
}
