import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const loginSchema = z.object({ email: z.string().trim().email() });

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json());
  if (!parsed.success) return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });

  const expectedEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!expectedEmail || !url || !publishableKey) {
    return Response.json({ error: 'Dashboard login is not configured yet.' }, { status: 500 });
  }
  if (parsed.data.email.toLowerCase() !== expectedEmail) {
    return Response.json({ error: 'That email is not authorized for this dashboard.' }, { status: 403 });
  }

  const origin = new URL(request.url).origin;
  const supabase = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ sent: true });
}
