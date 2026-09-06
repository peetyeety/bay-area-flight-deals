import { z } from 'zod';
import { createSupabaseAdmin } from '../../../../../lib/supabase/admin';
import { requireAdminApi } from '../../../../../lib/auth';

type RouteContext = { params: Promise<{ id: string }> };

const postSchema = z.object({
  caption: z.string().trim().min(1).max(2200),
  imageDataUrl: z.string().startsWith('data:image/jpeg;base64,'),
});

export async function POST(request: Request, { params }: RouteContext) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const result = postSchema.safeParse(await request.json());
  if (!result.success) {
    return Response.json({ error: 'The generated image or caption is invalid.' }, { status: 400 });
  }

  const { id: dealId } = await params;
  const supabase = createSupabaseAdmin();
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('id,status')
    .eq('id', dealId)
    .maybeSingle();

  if (dealError) return Response.json({ error: dealError.message }, { status: 500 });
  if (!deal) return Response.json({ error: 'Deal not found.' }, { status: 404 });
  if (!['verified', 'post_generated'].includes(deal.status)) {
    return Response.json({ error: 'The deal must be verified first.' }, { status: 409 });
  }

  const base64 = result.data.imageDataUrl.split(',')[1];
  const imageBytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  const imagePath = `${dealId}/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('instagram-posts')
    .upload(imagePath, imageBytes, { contentType: 'image/jpeg', cacheControl: '3600' });

  if (uploadError) return Response.json({ error: uploadError.message }, { status: 500 });

  const { data: post, error: postError } = await supabase
    .from('instagram_posts')
    .insert({ deal_id: dealId, caption: result.data.caption, image_path: imagePath, status: 'draft' })
    .select('id')
    .single();

  if (postError) {
    await supabase.storage.from('instagram-posts').remove([imagePath]);
    return Response.json({ error: postError.message }, { status: 500 });
  }

  const { error: statusError } = await supabase
    .from('deals')
    .update({ status: 'post_generated' })
    .eq('id', dealId);

  if (statusError) return Response.json({ error: statusError.message }, { status: 500 });

  const { data: publicImage } = supabase.storage.from('instagram-posts').getPublicUrl(imagePath);
  return Response.json({ postId: post.id, imageUrl: publicImage.publicUrl });
}
