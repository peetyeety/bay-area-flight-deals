import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAdminUser } from '../../lib/auth';
import LoginForm from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await getAdminUser()) redirect('/deals');

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand"><span>BA</span><div><strong>BAY AREA</strong><small>FLIGHT DEALS</small></div></div>
        <p className="login-kicker">PRIVATE OPERATIONS DASHBOARD</p>
        <h1>Welcome back.</h1>
        <p className="login-copy">Enter the authorized administrator email. We’ll send a one-time secure link—no password required.</p>
        <LoginForm />
        <Link className="public-site-link" href="/flights">← Return to public flight deals</Link>
      </section>
    </main>
  );
}
