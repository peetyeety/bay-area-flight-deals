import { z } from 'zod';
import { createSupabaseAdmin } from '../../../../lib/supabase/admin';

type RouteContext = { params: Promise<{ id: string }> };
const captionSchema = z.object({ caption: z.string().trim().min(1).max(2200) });

export async function PATCH(request: Request, { params }: RouteContext) {
  const result = captionSchema.safeParse(await request.json());
  if (!result.success) return Response.json({ error: 'Caption must contain 1–2,200 characters.' }, { status: 400 });

  const { id } = await params;
  const { error } = await createSupabaseAdmin()
    .from('instagram_posts')
    .update({ caption: result.data.caption })
    .eq('id', id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ saved: true });
}
