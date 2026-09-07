import type { Metadata } from 'next';
import Link from 'next/link';
import { listPublicDeals, type PublicFlightDeal } from '../../lib/public-deals';

type PageProps = {
  searchParams: Promise<{ origin?: string; sort?: string }>;
};

const origins = ['SFO', 'SJC', 'OAK'] as const;
type OriginFilter = 'ALL' | (typeof origins)[number];
type SortMode = 'savings' | 'price' | 'newest';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Current Bay Area Flight Deals | SFO, SJC & OAK',
  description: 'Recently verified flight deals departing from San Francisco, San Jose, and Oakland. Check live fares before they disappear.',
  openGraph: {
    title: 'Current Bay Area Flight Deals',
    description: 'Recently verified fare drops from SFO, SJC, and OAK.',
    images: [],
  },
  twitter: {
    card: 'summary',
    title: 'Current Bay Area Flight Deals',
    description: 'Recently verified fare drops from SFO, SJC, and OAK.',
    images: [],
  },
};

function currency(value: number, code: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code,
    maximumFractionDigits: 0,
  }).format(value);
}

function tripDate(value: string | null) {
  if (!value) return 'Flexible';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function observedAt(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Los_Angeles',
    timeZoneName: 'short',
  }).format(new Date(value));
}

function sortDeals(deals: PublicFlightDeal[], sort: SortMode) {
  return [...deals].sort((a, b) => {
    if (sort === 'price') return a.price - b.price;
    if (sort === 'newest') return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
    return b.percentBelowTypical - a.percentBelowTypical || a.price - b.price;
  });
}

export default async function PublicFlightsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const origin: OriginFilter = origins.includes(params.origin as (typeof origins)[number])
    ? params.origin as (typeof origins)[number]
    : 'ALL';
  const sort: SortMode = ['price', 'newest'].includes(params.sort ?? '')
    ? params.sort as SortMode
    : 'savings';
  const allDeals = await listPublicDeals();
  const visibleDeals = sortDeals(
    origin === 'ALL' ? allDeals : allDeals.filter((deal) => deal.origin === origin),
    sort,
  );
  const freshest = allDeals.reduce<string | null>((latest, deal) => (
    !latest || new Date(deal.lastSeenAt) > new Date(latest) ? deal.lastSeenAt : latest
  ), null);

  return (
    <main className="public-page">
      <header className="public-nav">
        <Link href="/flights" className="public-brand" aria-label="Bay Area Flight Deals">
          <span>BA</span>
          <strong>BAY AREA <small>FLIGHT DEALS</small></strong>
        </Link>
        <a className="instagram-link" href="https://www.instagram.com/bayflightdeals/" target="_blank" rel="noreferrer">
          @bayflightdeals <span aria-hidden="true">↗</span>
        </a>
      </header>

      <section className="public-hero">
        <div className="public-hero-copy">
          <p className="public-kicker"><span /> VERIFIED WITHIN THE LAST 24 HOURS</p>
          <h1>Better fares.<br /><em>From the Bay.</em></h1>
          <p>Exceptional round-trip prices leaving from SFO, SJC, and OAK—reviewed before they appear here.</p>
        </div>
        <div className="airport-cluster" aria-label="Bay Area airports covered">
          <div><span>SFO</span><small>San Francisco</small></div>
          <div><span>SJC</span><small>San Jose</small></div>
          <div><span>OAK</span><small>Oakland</small></div>
        </div>
      </section>

      <section className="public-deals-wrap" aria-labelledby="current-deals">
        <div className="public-deals-head">
          <div>
            <p className="section-label">LIVE FARE BOARD</p>
            <h2 id="current-deals">Current flight deals</h2>
            <p>{visibleDeals.length} {visibleDeals.length === 1 ? 'fare' : 'fares'} ready to check{freshest ? ` · Updated ${observedAt(freshest)}` : ''}</p>
          </div>
          <form className="public-filters" action="/flights">
            <label>
              From
              <select name="origin" defaultValue={origin}>
                <option value="ALL">All airports</option>
                {origins.map((airport) => <option value={airport} key={airport}>{airport}</option>)}
              </select>
            </label>
            <label>
              Sort
              <select name="sort" defaultValue={sort}>
                <option value="savings">Biggest savings</option>
                <option value="price">Lowest price</option>
                <option value="newest">Newest</option>
              </select>
            </label>
            <button type="submit">Apply</button>
          </form>
        </div>

        {visibleDeals.length ? (
          <div className="public-deal-grid">
            {visibleDeals.map((deal) => (
              <article className="public-deal-card" key={deal.id}>
                <div className={`destination-mark ${deal.region.toLowerCase()}`} aria-hidden="true">
                  <span>{deal.destinationAirport}</span>
                </div>
                <div className="deal-card-topline">
                  <span className="savings-pill">{Math.round(deal.percentBelowTypical)}% below typical</span>
                  <span className="trip-type">{deal.nonstop ? 'Nonstop' : 'Connecting'}</span>
                </div>
                <p className="public-route"><strong>{deal.origin}</strong><span aria-hidden="true">→</span><strong>{deal.destinationAirport}</strong></p>
                <h3>{deal.destinationCity}</h3>
                <p className="destination-country">{deal.destinationCountry}</p>
                <div className="public-price-row">
                  <div><strong>{currency(deal.price, deal.currency)}</strong><span>round trip</span></div>
                  <div><span>Typical fare</span><s>{currency(deal.typicalPrice, deal.currency)}</s></div>
                </div>
                <dl className="public-trip-facts">
                  <div><dt>DATES</dt><dd>{tripDate(deal.outboundDate)}–{tripDate(deal.returnDate)}</dd></div>
                  <div><dt>AIRLINE</dt><dd>{deal.airline}</dd></div>
                </dl>
                <p className="fare-timestamp">Fare last seen <time dateTime={deal.lastSeenAt}>{observedAt(deal.lastSeenAt)}</time></p>
                {deal.bookingUrl ? (
                  <a className="check-fare-button" href={deal.bookingUrl} target="_blank" rel="noopener noreferrer sponsored">
                    Check current fare <span aria-hidden="true">↗</span>
                  </a>
                ) : (
                  <span className="check-fare-button unavailable">Live search unavailable</span>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="public-empty-state">
            <span aria-hidden="true">✦</span>
            <h3>No verified deals match this view.</h3>
            <p>Fresh fares move quickly. Check back soon or follow @bayflightdeals for the next alert.</p>
            {origin !== 'ALL' && <Link href="/flights">See deals from all airports</Link>}
          </div>
        )}
      </section>

      <section className="public-trust-note">
        <strong>Fares move fast.</strong>
        <p>Prices shown are the most recently observed round-trip fares and are not guaranteed. Always confirm the final itinerary, baggage rules, and total price on the booking page.</p>
      </section>

      <footer className="public-footer">
        <div><strong>BAY AREA FLIGHT DEALS</strong><span>Local departures. Remarkable fares.</span></div>
        <span>Made for travelers flying from SFO · SJC · OAK</span>
      </footer>
    </main>
  );
}
