import { redirect } from 'next/navigation';
import { getAdminUser } from '../../lib/auth';
import LoginForm from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  if (await getAdminUser()) redirect('/deals');

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand"><span>LF</span><div><strong>LOCAL</strong><small>FLIGHT DEALS</small></div></div>
        <p className="login-kicker">PRIVATE OPERATIONS DASHBOARD</p>
        <h1>Welcome back.</h1>
        <p className="login-copy">Enter the authorized administrator email. We’ll send a one-time secure link—no password required.</p>
        <LoginForm />
      </section>
    </main>
  );
}
