'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { FlightDeal } from '../../lib/deals';
import SignOutButton from '../sign-out-button';

type Props = { deals: FlightDeal[]; scanProvider: 'mock' | 'amadeus' };
type SortMode = 'score' | 'price' | 'savings';

const nav = [
  ['✦', 'Deals', '12'],
  ['◎', 'Verified', '4'],
  ['▣', 'Content', ''],
  ['↻', 'Scan history', ''],
];

export default function DealsDashboard({ deals, scanProvider }: Props) {
  const router = useRouter();
  const [sortMode, setSortMode] = useState<SortMode>('score');
  const [origin, setOrigin] = useState('All airports');
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [lastRun, setLastRun] = useState('8 min ago');

  async function runScan() {
    setScanning(true);
    setScanMessage('');
    try {
      const response = await fetch('/api/scans', { method: 'POST' });
      const result = await response.json() as { candidatesFound?: number; observationsSaved?: number; error?: string };
      if (!response.ok) throw new Error(result.error ?? 'The test scan failed.');
      setLastRun('just now');
      setScanMessage(`${scanProvider === 'amadeus' ? 'Live' : 'Test'} scan complete: ${result.candidatesFound} candidates checked and ${result.observationsSaved} observations saved.`);
      router.refresh();
    } catch (error) {
      setScanMessage(error instanceof Error ? error.message : 'The test scan failed.');
    } finally {
      setScanning(false);
    }
  }

  const visibleDeals = useMemo(() => {
    const filtered = origin === 'All airports' ? deals : deals.filter((deal) => deal.origin === origin);
    return [...filtered].sort((a, b) => {
      if (sortMode === 'price') return a.price - b.price;
      if (sortMode === 'savings') return b.percentBelowTypical - a.percentBelowTypical;
      return b.score - a.score;
    });
  }, [deals, origin, sortMode]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link href="/deals" className="brand" aria-label="Local Flight Deals home">
          <span className="brand-mark">LF</span>
          <span><strong>LOCAL</strong><small>FLIGHT DEALS</small></span>
        </Link>
        <nav className="side-nav" aria-label="Main navigation">
          <p>WORKSPACE</p>
          {nav.map(([icon, label, count], index) => (
            <a key={label} className={index === 0 ? 'active' : ''} href={index === 0 ? '/deals' : '#'}>
              <span>{icon}</span>{label}{count && <b>{count}</b>}
            </a>
          ))}
        </nav>
        <div className="scan-card">
          <span className="pulse" />
          <div><strong>{scanProvider === 'amadeus' ? 'Live scanner ready' : 'Test scanner ready'}</strong><small>Last run {lastRun}</small></div>
        </div>
        <div className="sidebar-user">
          <span>PL</span><div><strong>Peter</strong><small>Administrator</small></div><b>•••</b>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="breadcrumbs"><span>Bay Area</span><b>/</b><strong>Deal queue</strong></div>
          <div className="top-actions"><button aria-label="Notifications">♢<i /></button><SignOutButton /><span className="avatar">PL</span></div>
        </header>

        <div className="content-wrap">
          <section className="page-intro">
            <div>
              <div className="eyebrow"><span className="live-dot" />LIVE DATABASE · {scanProvider === 'amadeus' ? 'AMADEUS FARES' : 'MOCK FARES'}</div>
              <h1>Flight deals worth checking.</h1>
              <p>Freshly scored fares from SFO, SJC, and OAK—ready for a quick human review.</p>
            </div>
            <button className="scan-button" onClick={runScan} disabled={scanning}><span>↻</span> {scanning ? 'Scanning…' : scanProvider === 'amadeus' ? 'Run live scan' : 'Run test scan'}</button>
          </section>

          {scanMessage && <p className="scan-result" role="status">{scanMessage}</p>}

          <section className="stats-row" aria-label="Deal summary">
            <div><span className="stat-icon coral">↘</span><p>New candidates<strong>12</strong></p><small>+3 today</small></div>
            <div><span className="stat-icon green">✓</span><p>Verified this week<strong>4</strong></p><small>33% hit rate</small></div>
            <div><span className="stat-icon violet">◇</span><p>Median savings<strong>42%</strong></p><small>vs. typical fare</small></div>
            <div><span className="stat-icon blue">⌁</span><p>Airports scanned<strong>3</strong></p><small>SFO · SJC · OAK</small></div>
          </section>

          <section className="queue-card">
            <div className="queue-head">
              <div><h2>Candidate queue</h2><p>{visibleDeals.length} deals awaiting review</p></div>
              <div className="filters">
                <label>Origin<select value={origin} onChange={(event) => setOrigin(event.target.value)}><option>All airports</option><option>SFO</option><option>SJC</option><option>OAK</option></select></label>
                <label>Sort by<select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}><option value="score">Highest score</option><option value="price">Lowest price</option><option value="savings">Biggest savings</option></select></label>
              </div>
            </div>
            <div className="deal-table" role="table" aria-label="Flight deal candidates">
              <div className="table-head" role="row"><span>DEAL</span><span>TRIP</span><span>FARE</span><span>SAVINGS</span><span>SCORE</span><span /></div>
              {visibleDeals.map((deal) => (
                <Link href={`/deals/${deal.id}`} className="deal-row" key={deal.id} role="row">
                  <span className={`place-icon ${deal.region.toLowerCase()}`}>{deal.destinationAirport.slice(0, 1)}</span>
                  <span className="deal-name"><strong>{deal.destinationCity}</strong><small>{deal.origin} <i>→</i> {deal.destinationAirport} · {deal.destinationCountry}</small></span>
                  <span className="trip"><strong>{deal.outboundDate}–{deal.returnDate}</strong><small>{deal.nonstop ? 'Nonstop' : '1 stop'} · {deal.airline}</small></span>
                  <span className="fare"><strong>${deal.price}</strong><small>round trip</small></span>
                  <span className="savings"><strong>{deal.percentBelowTypical}%</strong><small>typical ${deal.typicalPrice}</small></span>
                  <span className={`score score-${Math.floor(deal.score / 10)}`}><strong>{deal.score}</strong><small>/ 100</small></span>
                  <span className="row-arrow">›</span>
                </Link>
              ))}
            </div>
          </section>
          <footer><span>{scanProvider === 'amadeus' ? 'Amadeus data · Verify before posting' : 'Mock data · For development only'}</span><span>Prices last refreshed {lastRun}</span></footer>
        </div>
      </section>
    </main>
  );
}
