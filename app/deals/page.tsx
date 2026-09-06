import { airfareProvider } from '../../lib/supabase-airfare-provider';
import DealsDashboard from './deals-dashboard';

export default async function DealsPage() {
  const deals = await airfareProvider.listDeals();
  return <DealsDashboard deals={deals} />;
}
