import { z } from 'zod';
import { requireAdminApi } from '../../../../../lib/auth';
import { instagramErrorDetails, publishInstagramImage } from '../../../../../lib/instagram';
import { createSupabaseAdmin } from '../../../../../lib/supabase/admin';

type RouteContext = { params: Promise<{ id: string }> };
const publishSchema = z.object({ caption: z.string().trim().min(1).max(2200) });

export const maxDuration = 60;

export async function POST(request: Request, { params }: RouteContext) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  const input = publishSchema.safeParse(await request.json());
  if (!input.success) return Response.json({ error: 'Caption must contain 1–2,200 characters.' }, { status: 400 });

  const { id } = await params;
  const supabase = createSupabaseAdmin();
  const { data: post, error: postError } = await supabase
    .from('instagram_posts')
    .select('id,deal_id,image_path,status,instagram_permalink,deals!inner(origin,destination_airport,destination_city,status)')
    .eq('id', id)
    .maybeSingle();

  if (postError) return Response.json({ error: postError.message }, { status: 500 });
  if (!post) return Response.json({ error: 'Instagram draft not found.' }, { status: 404 });
  if (post.status === 'published') {
    return Response.json({ published: true, permalink: post.instagram_permalink, alreadyPublished: true });
  }
  if (!['draft', 'approved', 'failed'].includes(post.status)) {
    return Response.json({ error: 'This Instagram draft is already being published.' }, { status: 409 });
  }
  if (!post.image_path) return Response.json({ error: 'Generate the Instagram image before publishing.' }, { status: 409 });

  const deal = Array.isArray(post.deals) ? post.deals[0] : post.deals;
  if (!deal || !['verified', 'post_generated'].includes(deal.status)) {
    return Response.json({ error: 'Only a currently verified deal can be published.' }, { status: 409 });
  }

  const { data: publicImage } = supabase.storage.from('instagram-posts').getPublicUrl(post.image_path);
  const { error: publishingError } = await supabase
    .from('instagram_posts')
    .update({ caption: input.data.caption, status: 'publishing' })
    .eq('id', id);
  if (publishingError) return Response.json({ error: publishingError.message }, { status: 500 });

  try {
    const published = await publishInstagramImage({
      imageUrl: publicImage.publicUrl,
      caption: input.data.caption,
      altText: `${deal.origin} to ${deal.destination_city} (${deal.destination_airport}) round-trip flight deal from Bay Area Flight Deals.`,
    });

    const { error: updateError } = await supabase
      .from('instagram_posts')
      .update({
        status: 'published',
        published_at: published.publishedAt,
        instagram_media_id: published.mediaId,
        instagram_permalink: published.permalink,
      })
      .eq('id', id);
    if (updateError) throw new Error(updateError.message);

    await supabase.from('deals').update({ status: 'published' }).eq('id', post.deal_id);
    await supabase.from('publishing_attempts').insert({
      instagram_post_id: id,
      succeeded: true,
      provider_response: published.providerResponse,
    });

    return Response.json({
      published: true,
      permalink: published.permalink,
      username: published.username,
      publishedAt: published.publishedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Instagram publishing failed.';
    await supabase.from('instagram_posts').update({ status: 'failed' }).eq('id', id);
    await supabase.from('publishing_attempts').insert({
      instagram_post_id: id,
      succeeded: false,
      provider_response: instagramErrorDetails(error),
      error_message: message,
    });
    return Response.json({ error: message }, { status: 502 });
  }
}
