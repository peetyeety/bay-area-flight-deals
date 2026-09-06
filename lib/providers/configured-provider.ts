import { createAmadeusProviderFromEnvironment } from './amadeus-provider.ts';
import { mockFlightDataProvider } from './mock-provider.ts';
import type { FlightDataProvider } from './types.ts';

export type FlightProviderName = 'mock' | 'amadeus';

export function configuredFlightProviderName(): FlightProviderName {
  return process.env.FLIGHT_PROVIDER?.toLowerCase() === 'amadeus' ? 'amadeus' : 'mock';
}

export function configuredFlightProvider(): FlightDataProvider {
  return configuredFlightProviderName() === 'amadeus'
    ? createAmadeusProviderFromEnvironment()
    : mockFlightDataProvider;
}
