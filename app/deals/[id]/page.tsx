import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { airfareProvider } from '../../../lib/supabase-airfare-provider';
import { requireAdminPage } from '../../../lib/auth';
import DealReview from './deal-review';

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const deal = await airfareProvider.getDeal(id);
  if (!deal) return { title: 'Deal not found', openGraph: { images: [] }, twitter: { images: [] } };
  const description = `$${deal.price} round trip from ${deal.origin} to ${deal.destinationCity}, ${deal.percentBelowTypical}% below typical.`;
  return {
    title: `${deal.origin} → ${deal.destinationCity} for $${deal.price} | Bay Area Flight Deals`,
    description,
    openGraph: { title: `${deal.origin} → ${deal.destinationCity} for $${deal.price}`, description, images: [] },
    twitter: { card: 'summary', title: `${deal.origin} → ${deal.destinationCity} for $${deal.price}`, description, images: [] },
  };
}

export default async function DealPage({ params }: PageProps) {
  const { id } = await params;
  await requireAdminPage(`/deals/${id}`);
  const deal = await airfareProvider.getDeal(id);
  if (!deal) notFound();
  return <DealReview deal={deal} />;
}
