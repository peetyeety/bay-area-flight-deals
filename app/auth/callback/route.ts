import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const requestedNext = requestUrl.searchParams.get('next') ?? '/deals';
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/deals';

  if (!code) return NextResponse.redirect(new URL('/login?error=missing-code', requestUrl.origin));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL('/login?error=expired-link', requestUrl.origin));

  const { data: { user } } = await supabase.auth.getUser();
  const expectedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!user?.email || user.email.toLowerCase() !== expectedEmail) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL('/login?error=unauthorized', requestUrl.origin));
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
