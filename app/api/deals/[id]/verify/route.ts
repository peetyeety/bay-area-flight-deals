import { createSupabaseAdmin } from '../../../../../lib/supabase/admin';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const supabase = createSupabaseAdmin();
  const { data: deal, error: readError } = await supabase
    .from('deals')
    .select('price')
    .eq('id', id)
    .maybeSingle();

  if (readError) return Response.json({ error: readError.message }, { status: 500 });
  if (!deal) return Response.json({ error: 'Deal not found.' }, { status: 404 });

  const { error: updateError } = await supabase
    .from('deals')
    .update({ status: 'verified', verified_price: deal.price, verified_at: new Date().toISOString() })
    .eq('id', id);

  if (updateError) return Response.json({ error: updateError.message }, { status: 500 });
  return Response.json({ verified: true });
}
