import { z } from 'zod';
import { createSupabaseAdmin } from '../../../../lib/supabase/admin';
import { requireAdminApi } from '../../../../lib/auth';

type RouteContext = { params: Promise<{ id: string }> };
const captionSchema = z.object({ caption: z.string().trim().min(1).max(2200) });

export async function PATCH(request: Request, { params }: RouteContext) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
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

// Instagram does not send this app a reliable notification when a post is
// deleted in the Instagram app. This records that manual deletion locally and
// reopens the deal for a replacement creative.
export async function DELETE(_request: Request, { params }: RouteContext) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const supabase = createSupabaseAdmin();
  const { data: post, error: postError } = await supabase
    .from('instagram_posts')
    .select('id,deal_id,status')
    .eq('id', id)
    .maybeSingle();

  if (postError) return Response.json({ error: postError.message }, { status: 500 });
  if (!post) return Response.json({ error: 'Instagram post not found.' }, { status: 404 });
  if (post.status !== 'published') {
    return Response.json({ error: 'Only a published post can be marked as removed.' }, { status: 409 });
  }

  const { error: updatePostError } = await supabase
    .from('instagram_posts')
    .update({
      status: 'failed',
      instagram_media_id: null,
      instagram_permalink: null,
    })
    .eq('id', id);
  if (updatePostError) return Response.json({ error: updatePostError.message }, { status: 500 });

  const { error: updateDealError } = await supabase
    .from('deals')
    .update({ status: 'verified' })
    .eq('id', post.deal_id);
  if (updateDealError) return Response.json({ error: updateDealError.message }, { status: 500 });

  await supabase.from('publishing_attempts').insert({
    instagram_post_id: id,
    succeeded: false,
    error_message: 'Post was manually deleted from Instagram.',
  });

  return Response.json({ removed: true });
}
