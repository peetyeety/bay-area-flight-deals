'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlightDeal } from '../../../lib/deals';
import SignOutButton from '../../sign-out-button';

type Props = { deal: FlightDeal };

type DestinationPhoto = {
  image: HTMLImageElement;
  photographer: string;
  photographerUrl: string;
  photoUrl: string;
};

type PhotoApiResponse = {
  available?: boolean;
  imageDataUrl?: string;
  photographer?: string;
  photographerUrl?: string;
  photoUrl?: string;
};

const PHOTO_CREDIT_PREFIX = '📷 Photo: ';

function buildCaption(deal: FlightDeal) {
  return `BAY AREA → ${deal.destinationCity.toUpperCase()} ✈️\n\n$${deal.price} round trip from ${deal.origin} — ${deal.nonstop ? 'nonstop' : 'one stop'} on ${deal.airline}. That’s ${deal.percentBelowTypical}% below the typical fare we track.\n\n📅 ${deal.outboundDate}–${deal.returnDate}\n💸 Typical fare: $${deal.typicalPrice}\n\nFares move fast. Always confirm the final price and dates before booking.\n\n#BayAreaFlights #FlightDeals #${deal.destinationCity.replace(/\s/g, '')} #CheapFlights`;
}

function captionWithPhotoCredit(caption: string, photo: DestinationPhoto) {
  const withoutOldCredit = caption
    .split('\n')
    .filter((line) => !line.startsWith(PHOTO_CREDIT_PREFIX))
    .join('\n')
    .trim();
  return `${withoutOldCredit}\n\n${PHOTO_CREDIT_PREFIX}${photo.photographer} via Pexels — ${photo.photoUrl}`;
}

function drawImageCover(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const frameRatio = width / height;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  let sourceX = 0;
  let sourceY = 0;

  if (imageRatio > frameRatio) {
    sourceWidth = image.naturalHeight * frameRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = image.naturalWidth / frameRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }

  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function fittedFont(context: CanvasRenderingContext2D, text: string, preferredSize: number, minimumSize: number, maxWidth: number) {
  let size = preferredSize;
  context.font = `800 ${size}px Arial`;
  while (size > minimumSize && context.measureText(text).width > maxWidth) {
    size -= 2;
    context.font = `800 ${size}px Arial`;
  }
}

function drawLocationPin(context: CanvasRenderingContext2D, x: number, y: number) {
  context.save();
  context.translate(x, y);
  context.fillStyle = '#f25f45';
  context.beginPath();
  context.moveTo(34, 76);
  context.bezierCurveTo(27, 65, 5, 42, 5, 27);
  context.bezierCurveTo(5, 10, 18, 0, 34, 0);
  context.bezierCurveTo(50, 0, 63, 10, 63, 27);
  context.bezierCurveTo(63, 42, 41, 65, 34, 76);
  context.fill();
  context.fillStyle = '#f6f0e7';
  context.beginPath();
  context.arc(34, 27, 10, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawCalendar(context: CanvasRenderingContext2D, x: number, y: number) {
  context.save();
  context.strokeStyle = '#202a31';
  context.lineWidth = 5;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.beginPath();
  context.roundRect(x, y + 7, 52, 49, 7);
  context.stroke();
  context.beginPath();
  context.moveTo(x, y + 23);
  context.lineTo(x + 52, y + 23);
  context.moveTo(x + 14, y);
  context.lineTo(x + 14, y + 15);
  context.moveTo(x + 38, y);
  context.lineTo(x + 38, y + 15);
  context.stroke();
  context.restore();
}

function drawPost(canvas: HTMLCanvasElement, deal: FlightDeal, destinationPhoto?: HTMLImageElement) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const width = 1080;
  const height = 1350;
  canvas.width = width;
  canvas.height = height;

  context.fillStyle = '#f6f0e7';
  context.fillRect(0, 0, width, height);
  context.strokeStyle = '#202a31';
  context.lineWidth = 3;
  context.setLineDash([10, 14]);
  context.beginPath();
  context.moveTo(730, 80);
  context.bezierCurveTo(550, 220, 860, 300, 660, 430);
  context.stroke();
  context.setLineDash([]);

  context.fillStyle = '#202a31';
  context.font = '800 36px Arial';
  context.fillText('FLIGHT DEAL ALERT', 72, 104);

  const destinationName = deal.destinationCity.toUpperCase();
  drawLocationPin(context, 67, 316);
  context.fillStyle = '#202a31';
  fittedFont(context, destinationName, 118, 62, 865);
  context.fillText(destinationName, 153, 398);
  context.font = '800 62px Arial';
  context.fillStyle = '#f25f45';
  context.fillText(`${deal.origin}  →  ${deal.destinationAirport}`, 68, 475);

  context.fillStyle = '#ffffff';
  context.beginPath();
  context.roundRect(65, 515, 950, 520, 34);
  context.fill();
  context.fillStyle = '#202a31';
  context.font = '700 32px Arial';
  context.fillText('ROUND TRIP FROM', 112, 595);
  context.font = '800 236px Arial';
  context.fillText(`$${deal.price}`, 95, 825);
  context.fillStyle = '#2b9a71';
  context.font = '800 39px Arial';
  context.fillText(`${deal.percentBelowTypical}% BELOW TYPICAL`, 112, 903);
  context.strokeStyle = '#e7e2da';
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(112, 945);
  context.lineTo(968, 945);
  context.stroke();
  context.fillStyle = '#5f686c';
  context.font = '700 25px Arial';
  context.fillText(`${deal.nonstop ? 'NONSTOP' : '1 STOP'}  ·  ${deal.airline.toUpperCase()}`, 112, 995);

  context.fillStyle = '#202a31';
  const dateRange = `${deal.outboundDate.toUpperCase()} — ${deal.returnDate.toUpperCase()}`;
  drawCalendar(context, 68, 1091);
  fittedFont(context, dateRange, 56, 40, 490);
  context.fillText(dateRange, 140, 1148);
  context.font = '500 22px Arial';
  context.fillStyle = '#717a7d';
  context.fillText('Prices can change anytime. Verify before booking.', 68, 1192);

  context.fillStyle = '#202a31';
  context.fillRect(0, 1240, width, 110);

  const photoCenterX = 930;
  const photoCenterY = 1115;
  const photoRadius = 290;
  context.fillStyle = '#f25f45';
  context.beginPath();
  context.arc(photoCenterX, photoCenterY, photoRadius, 0, Math.PI * 2);
  context.fill();
  if (destinationPhoto) {
    context.save();
    context.beginPath();
    context.arc(photoCenterX, photoCenterY, photoRadius, 0, Math.PI * 2);
    context.clip();
    drawImageCover(
      context,
      destinationPhoto,
      photoCenterX - photoRadius,
      photoCenterY - photoRadius,
      photoRadius * 2,
      photoRadius * 2,
    );
    context.fillStyle = 'rgba(32, 42, 49, 0.09)';
    context.fillRect(photoCenterX - photoRadius, photoCenterY - photoRadius, photoRadius * 2, photoRadius * 2);
    context.restore();
    context.strokeStyle = '#ffffff';
    context.lineWidth = 8;
    context.beginPath();
    context.arc(photoCenterX, photoCenterY, photoRadius - 4, 0, Math.PI * 2);
    context.stroke();
  }

  context.fillStyle = '#ffffff';
  context.font = '700 22px Arial';
  context.textAlign = 'left';
  context.fillText('@BAYFLIGHTDEALS', 68, 1307);
}

export default function DealReview({ deal }: Props) {
  const [verified, setVerified] = useState(['verified', 'post_generated', 'published'].includes(deal.status ?? ''));
  const [verifying, setVerifying] = useState(false);
  const [generated, setGenerated] = useState(Boolean(deal.latestPost));
  const [generating, setGenerating] = useState(false);
  const [savingCaption, setSavingCaption] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(deal.latestPost?.status === 'published');
  const [permalink, setPermalink] = useState(deal.latestPost?.permalink ?? '');
  const [instagramConnection, setInstagramConnection] = useState<'checking' | 'connected' | 'not-connected'>('checking');
  const [instagramUsername, setInstagramUsername] = useState('bayflightdeals');
  const [postId, setPostId] = useState(deal.latestPost?.id ?? '');
  const [caption, setCaption] = useState(() => deal.latestPost?.caption ?? buildCaption(deal));
  const [notice, setNotice] = useState('');
  const [photoCredit, setPhotoCredit] = useState<Omit<DestinationPhoto, 'image'> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoPromiseRef = useRef<Promise<DestinationPhoto | null> | null>(null);

  const loadDestinationPhoto = useCallback(() => {
    if (photoPromiseRef.current) return photoPromiseRef.current;
    photoPromiseRef.current = fetch(`/api/deals/${deal.id}/photo`)
      .then(async (response) => {
        if (!response.ok) return null;
        const result = await response.json() as PhotoApiResponse;
        if (!result.available || !result.imageDataUrl || !result.photographer || !result.photographerUrl || !result.photoUrl) return null;
        const image = new Image();
        image.src = result.imageDataUrl;
        await image.decode();
        return {
          image,
          photographer: result.photographer,
          photographerUrl: result.photographerUrl,
          photoUrl: result.photoUrl,
        };
      })
      .catch(() => null);
    return photoPromiseRef.current;
  }, [deal.id]);

  useEffect(() => {
    if (!generated || !canvasRef.current) return;
    let active = true;
    const canvas = canvasRef.current;
    drawPost(canvas, deal);
    loadDestinationPhoto().then((photo) => {
      if (!active || !photo) return;
      setPhotoCredit(photo);
      drawPost(canvas, deal, photo.image);
    });
    return () => { active = false; };
  }, [generated, deal, loadDestinationPhoto]);

  useEffect(() => {
    let active = true;
    fetch('/api/instagram/status')
      .then((response) => response.json())
      .then((result: { connected?: boolean; username?: string }) => {
        if (active) {
          setInstagramUsername(result.username ?? 'bayflightdeals');
          setInstagramConnection(result.connected ? 'connected' : 'not-connected');
        }
      })
      .catch(() => {
        if (active) setInstagramConnection('not-connected');
      });
    return () => { active = false; };
  }, []);

  const verify = async () => {
    setVerifying(true);
    try {
      const response = await fetch(`/api/deals/${deal.id}/verify`, { method: 'PATCH' });
      if (!response.ok) throw new Error('Verification could not be saved.');
      setVerified(true);
      setNotice('Deal verified and saved to the database.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Verification could not be saved.');
    } finally {
      setVerifying(false);
    }
  };

  const generate = async () => {
    setGenerating(true);
    setGenerated(true);
    try {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('The image preview could not be created.');
      const photo = await loadDestinationPhoto();
      const nextCaption = photo ? captionWithPhotoCredit(caption, photo) : caption;
      if (photo) {
        setPhotoCredit(photo);
        setCaption(nextCaption);
      }
      drawPost(canvas, deal, photo?.image);

      const response = await fetch(`/api/deals/${deal.id}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: nextCaption, imageDataUrl: canvas.toDataURL('image/jpeg', 0.92) }),
      });
      const result = await response.json() as { postId?: string; error?: string };
      if (!response.ok || !result.postId) throw new Error(result.error ?? 'The Instagram draft could not be saved.');

      setPostId(result.postId);
      setPublished(false);
      setPermalink('');
      setNotice('Instagram draft and image saved to Supabase.');
      document.getElementById('content-studio')?.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The Instagram draft could not be saved.');
    } finally {
      setGenerating(false);
    }
  };

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const anchor = document.createElement('a');
    anchor.download = `${deal.origin}-${deal.destinationAirport}-flight-deal.jpg`;
    anchor.href = canvas.toDataURL('image/jpeg', 0.92);
    anchor.click();
    setNotice('Image downloaded.');
  };

  const copyCaption = async () => {
    await navigator.clipboard.writeText(caption);
    setNotice('Caption copied to clipboard.');
  };

  const saveCaption = async () => {
    if (!postId) return;
    setSavingCaption(true);
    try {
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? 'The caption could not be saved.');
      setNotice('Caption changes saved.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The caption could not be saved.');
    } finally {
      setSavingCaption(false);
    }
  };

  const publish = async () => {
    if (!postId || publishing || published) return;
    setPublishing(true);
    try {
      const response = await fetch(`/api/posts/${postId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption }),
      });
      const result = await response.json() as { permalink?: string | null; username?: string; error?: string };
      if (!response.ok) throw new Error(result.error ?? 'The Instagram post could not be published.');
      setPublished(true);
      setPermalink(result.permalink ?? '');
      setNotice(`Published to @${result.username ?? 'bayflightdeals'} successfully.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The Instagram post could not be published.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <main className="review-page">
      <header className="review-topbar">
        <Link href="/deals" className="review-brand"><span>BA</span><strong>BAY AREA FLIGHT DEALS</strong></Link>
        <div className="review-top-actions"><span className="mock-pill">{deal.provider?.includes('serpapi') ? 'GOOGLE FLIGHTS DEAL' : deal.provider?.startsWith('amadeus') ? 'AMADEUS DATA' : 'MOCK DATA'}</span><SignOutButton /><span className="avatar">PL</span></div>
      </header>

      <div className="review-wrap">
        <Link href="/deals" className="back-link">← Back to candidate queue</Link>
        <section className="deal-hero">
          <div>
            <div className="route-line"><span>{deal.origin}</span><i>→</i><span>{deal.destinationAirport}</span></div>
            <h1>{deal.destinationCity}</h1>
            <p>{deal.destinationCountry} · {deal.outboundDate}–{deal.returnDate}</p>
          </div>
          <div className="hero-score"><span>DEAL SCORE</span><strong>{deal.score}</strong><small>/ 100</small></div>
        </section>

        <div className="review-grid">
          <section className="review-main">
            <div className="fare-summary card-panel">
              <div className="fare-price"><span>CURRENT FARE</span><strong>${deal.price}</strong><small>round trip</small></div>
              <div className="fare-facts">
                <div><span>ROUTING</span><strong>{deal.nonstop ? 'Nonstop' : '1 stop'}</strong></div>
                <div><span>AIRLINE</span><strong>{deal.airline}</strong></div>
                <div><span>DATES</span><strong>{deal.outboundDate}–{deal.returnDate}</strong></div>
              </div>
              <div className="savings-callout"><span>↘</span><div><strong>{deal.percentBelowTypical}% below typical</strong><small>Typical tracked fare is ${deal.typicalPrice}</small></div></div>
            </div>

            <section className="card-panel comparison-panel">
              <div className="section-heading"><div><span>AIRPORT CHECK</span><h2>Bay Area comparison</h2></div><small>Same dates · Round trip</small></div>
              <div className="comparison-list">
                {deal.comparison.map((item) => (
                  <div key={item.airport} className={item.airport === deal.origin ? 'best-airport' : ''}>
                    <span className="airport-badge">{item.airport}</span>
                    <div><strong>{item.airport === 'SFO' ? 'San Francisco' : item.airport === 'SJC' ? 'San Jose' : 'Oakland'}</strong><small>{item.airport === deal.origin ? 'Best available fare' : item.price ? `$${item.price - deal.price} more` : 'No comparable itinerary'}</small></div>
                    <b>{item.price ? `$${item.price}` : 'Unavailable'}</b>
                    {item.airport === deal.origin && <em>BEST</em>}
                  </div>
                ))}
              </div>
            </section>
          </section>

          <aside className="review-sidebar">
            <section className="card-panel action-panel">
              <span className="section-kicker">HUMAN REVIEW</span>
              <h2>{verified ? 'Deal verified' : 'Ready to verify?'}</h2>
              <p>{verified ? 'The fare is approved for social content.' : 'Confirm the fare, dates, and routing match the source before publishing.'}</p>
              {deal.bookingUrl && <a className="booking-action" href={deal.bookingUrl} target="_blank" rel="noreferrer">View on Google Flights ↗</a>}
              {!verified ? (
                <button className="primary-action" onClick={verify} disabled={verifying}>{verifying ? 'Saving…' : '✓ Verify Deal'}</button>
              ) : (
                <div className="verified-state"><span>✓</span><strong>Verified just now</strong></div>
              )}
              <button className="generate-action" onClick={generate} disabled={!verified || generating}>{generating ? 'Saving draft…' : generated ? '✦ Regenerate Instagram Post' : '✦ Generate Instagram Post'}</button>
              {!verified && <small className="action-hint">Verify this deal to unlock content generation</small>}
            </section>
            <section className="card-panel source-panel">
              <span className="section-kicker">SOURCE DETAILS</span>
              <dl><div><dt>Provider</dt><dd>{deal.provider ?? 'Unknown'}</dd></div><div><dt>Last seen</dt><dd>{deal.seenAgo}</dd></div><div><dt>Currency</dt><dd>{deal.currency ?? 'USD'}</dd></div></dl>
              {deal.bookingUrl && <a href={deal.bookingUrl} target="_blank" rel="noreferrer">Open fare search ↗</a>}
            </section>
          </aside>
        </div>

        {generated && (
          <section id="content-studio" className="content-studio">
            <div className="studio-head"><div><span>CONTENT STUDIO</span><h2>Your post is ready.</h2><p>Review the creative, fine-tune the caption, then export.</p></div><span className="ready-pill">✓ 1080 × 1350</span></div>
            <div className="studio-grid">
              <div className="canvas-panel">
                <canvas ref={canvasRef} aria-label={`Instagram graphic for ${deal.origin} to ${deal.destinationCity}`} />
                {photoCredit && <p className="photo-credit">Photo by <a href={photoCredit.photographerUrl} target="_blank" rel="noreferrer">{photoCredit.photographer}</a> on <a href={photoCredit.photoUrl} target="_blank" rel="noreferrer">Pexels</a></p>}
                <button onClick={download} className="download-action">↓ Download image</button>
              </div>
              <div className="caption-panel">
                <label htmlFor="caption">INSTAGRAM CAPTION <span>{caption.length} characters</span></label>
                <div className={`instagram-status ${instagramConnection}`}><span />{instagramConnection === 'checking' ? 'Checking Instagram connection…' : instagramConnection === 'connected' ? `Connected to @${instagramUsername}` : 'Instagram connection not configured'}</div>
                <textarea id="caption" value={caption} onChange={(event) => setCaption(event.target.value)} />
                <div className="caption-actions">
                  <button onClick={saveCaption} className="save-caption-action" disabled={!postId || savingCaption}>{savingCaption ? 'Saving…' : '✓ Save changes'}</button>
                  <button onClick={copyCaption} className="copy-action">▣ Copy caption</button>
                  {published && permalink ? (
                    <a className="publish-action published" href={permalink} target="_blank" rel="noreferrer">✓ View published post on Instagram ↗</a>
                  ) : (
                    <button onClick={publish} className="publish-action" disabled={!postId || publishing || instagramConnection !== 'connected'}>{publishing ? 'Publishing to Instagram…' : instagramConnection === 'connected' ? `Publish now to @${instagramUsername}` : 'Connect Instagram to publish'}</button>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
      {notice && <div className="toast" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss">×</button></div>}
    </main>
  );
}
