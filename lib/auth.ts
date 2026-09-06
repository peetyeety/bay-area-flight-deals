import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from './supabase/server';

function adminEmail() {
  return process.env.ADMIN_EMAIL?.trim().toLowerCase();
}

export async function getAdminUser() {
  const expectedEmail = adminEmail();
  if (process.env.NODE_ENV === 'development' && process.env.LOCAL_AUTH_BYPASS === 'true') {
    return { id: 'local-development', email: expectedEmail ?? 'local@development.invalid' };
  }
  if (!expectedEmail) return null;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email?.toLowerCase() === expectedEmail ? user : null;
}

export async function requireAdminPage(returnTo: string) {
  const user = await getAdminUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  return user;
}

export async function requireAdminApi() {
  const user = await getAdminUser();
  if (!user) return Response.json({ error: 'Please sign in again.' }, { status: 401 });
  return null;
}
