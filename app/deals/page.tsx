import { airfareProvider } from '../../lib/supabase-airfare-provider';
import { requireAdminPage } from '../../lib/auth';
import DealsDashboard from './deals-dashboard';

export default async function DealsPage() {
  await requireAdminPage('/deals');
  const deals = await airfareProvider.listDeals();
  return <DealsDashboard deals={deals} />;
}
