import { createSupabaseAdmin } from '../../../../../lib/supabase/admin';
import { requireAdminApi } from '../../../../../lib/auth';

type RouteContext = { params: Promise<{ id: string }> };

type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  photographer: string;
  photographer_url: string;
  url: string;
  src: {
    large2x?: string;
    large?: string;
    landscape?: string;
  };
};

type PexelsSearchResponse = {
  photos?: PexelsPhoto[];
};

function photoSearch(city: string, country: string) {
  const params = new URLSearchParams({
    query: `${city} ${country} city skyline landmark travel`,
    orientation: 'landscape',
    size: 'medium',
    per_page: '10',
  });
  return `https://api.pexels.com/v1/search?${params}`;
}

function selectPhoto(photos: PexelsPhoto[]) {
  return photos.find((photo) => photo.width >= photo.height && (photo.src.landscape || photo.src.large || photo.src.large2x));
}

export async function GET(_request: Request, { params }: RouteContext) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return Response.json({ available: false, reason: 'Pexels is not configured.' });

  const { id } = await params;
  const supabase = createSupabaseAdmin();
  const { data: deal, error: dealError } = await supabase
    .from('deals')
    .select('destination_city,destination_country')
    .eq('id', id)
    .maybeSingle();

  if (dealError) return Response.json({ error: dealError.message }, { status: 500 });
  if (!deal) return Response.json({ error: 'Deal not found.' }, { status: 404 });

  try {
    const searchResponse = await fetch(photoSearch(deal.destination_city, deal.destination_country), {
      headers: { Authorization: apiKey },
      next: { revalidate: 86_400 },
    });
    if (!searchResponse.ok) {
      return Response.json({ available: false, reason: `Pexels returned HTTP ${searchResponse.status}.` });
    }

    const search = await searchResponse.json() as PexelsSearchResponse;
    const photo = selectPhoto(search.photos ?? []);
    const imageUrl = photo?.src.landscape ?? photo?.src.large ?? photo?.src.large2x;
    if (!photo || !imageUrl) return Response.json({ available: false, reason: 'No suitable destination photo was found.' });

    const imageResponse = await fetch(imageUrl, { next: { revalidate: 86_400 } });
    if (!imageResponse.ok) {
      return Response.json({ available: false, reason: 'The destination photo could not be downloaded.' });
    }

    const contentType = imageResponse.headers.get('content-type') ?? 'image/jpeg';
    if (!contentType.startsWith('image/')) {
      return Response.json({ available: false, reason: 'Pexels returned an invalid image.' });
    }

    const bytes = await imageResponse.arrayBuffer();
    if (bytes.byteLength > 3_000_000) {
      return Response.json({ available: false, reason: 'The destination photo was too large.' });
    }

    return Response.json({
      available: true,
      imageDataUrl: `data:${contentType};base64,${Buffer.from(bytes).toString('base64')}`,
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url,
      photoUrl: photo.url,
    }, {
      headers: { 'Cache-Control': 'private, max-age=3600' },
    });
  } catch {
    return Response.json({ available: false, reason: 'Pexels could not be reached.' });
  }
}
