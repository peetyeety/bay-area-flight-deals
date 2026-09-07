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

const landmarkSearchTerms: Record<string, string> = {
  ALG: 'Algiers Casbah basilica skyline',
  ATL: 'Atlanta downtown skyline',
  BEG: 'Belgrade fortress skyline',
  BER: 'Berlin Brandenburg Gate',
  YYC: 'Calgary Tower skyline',
  CBR: 'Canberra Parliament House',
  CMN: 'Casablanca Hassan II Mosque',
  CRW: 'Charleston West Virginia Capitol skyline',
  YYG: 'Charlottetown Prince Edward Island waterfront',
  QKL: 'Cologne Cathedral Rhine',
  DFW: 'Dallas skyline Reunion Tower',
  EAS: 'San Sebastian La Concha bay',
  IBZ: 'Ibiza Dalt Vila old town',
  FLR: 'Florence Duomo skyline',
  GRX: 'Granada Alhambra palace',
  GCM: 'Grand Cayman Seven Mile Beach',
  ISP: 'Long Island New York Montauk lighthouse',
  TYS: 'Knoxville Sunsphere skyline',
  LAS: 'Las Vegas Strip skyline',
  LWS: 'Lewiston Idaho Snake River canyon',
  LAX: 'Los Angeles Hollywood sign skyline',
  MSN: 'Madison Wisconsin Capitol skyline',
  RAK: 'Marrakesh Koutoubia mosque medina',
  MFR: 'Medford Oregon Rogue Valley mountains',
  MXP: 'Milan Duomo cathedral',
  MOZ: 'Moorea French Polynesia lagoon mountains',
  MLM: 'Morelia Cathedral Mexico',
  NAS: 'Nassau Bahamas waterfront',
  ZAQ: 'Nuremberg Castle old town',
  PMI: 'Palma Mallorca Cathedral waterfront',
  PSC: 'Tri Cities Washington Columbia River',
  PWM: 'Portland Maine lighthouse waterfront',
  PRG: 'Prague Charles Bridge castle',
  PVU: 'Provo Utah mountains skyline',
  RAR: 'Rarotonga lagoon mountains',
  STT: 'Saint Thomas Charlotte Amalie harbor',
  SAN: 'San Diego skyline Coronado',
  SNA: 'Orange County California Laguna Beach coast',
  SCQ: 'Santiago de Compostela Cathedral',
  SEA: 'Seattle Space Needle skyline',
  ARN: 'Stockholm Gamla Stan waterfront',
  TLH: 'Tallahassee Florida Capitol',
  TNG: 'Tangier Morocco medina coast',
  TWF: 'Twin Falls Idaho Shoshone Falls',
  VIE: 'Vienna St Stephen Cathedral skyline',
  WAW: 'Warsaw Old Town skyline',
  ZRH: 'Zurich old town lake skyline',
};

function photoSearch(city: string, country: string, airport: string) {
  const landmarkQuery = landmarkSearchTerms[airport]
    ?? `${city} ${country} iconic landmark skyline`;
  const params = new URLSearchParams({
    query: landmarkQuery,
    orientation: 'landscape',
    size: 'medium',
    per_page: '15',
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
    .select('destination_airport,destination_city,destination_country')
    .eq('id', id)
    .maybeSingle();

  if (dealError) return Response.json({ error: dealError.message }, { status: 500 });
  if (!deal) return Response.json({ error: 'Deal not found.' }, { status: 404 });

  try {
    const searchResponse = await fetch(photoSearch(deal.destination_city, deal.destination_country, deal.destination_airport), {
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
