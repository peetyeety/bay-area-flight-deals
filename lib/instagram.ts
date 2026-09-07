type InstagramProfile = {
  id: string;
  user_id?: string;
  username: string;
};

type InstagramPublishResult = {
  mediaId: string;
  permalink: string | null;
  publishedAt: string;
  username: string;
  providerResponse: unknown;
};

type MetaErrorBody = {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
  };
};

const graphVersion = process.env.INSTAGRAM_GRAPH_API_VERSION ?? 'v26.0';
const graphBaseUrl = `https://graph.instagram.com/${graphVersion}`;

function accessToken() {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  if (!token) throw new Error('Instagram is not connected yet. Add INSTAGRAM_ACCESS_TOKEN in Vercel.');
  return token;
}

async function parseMetaResponse<T>(response: Response): Promise<T> {
  const body = await response.json() as T & MetaErrorBody;
  if (!response.ok || body.error) {
    const detail = body.error?.message ?? `Instagram returned HTTP ${response.status}.`;
    throw new Error(detail);
  }
  return body;
}

async function instagramGet<T>(path: string, params: Record<string, string>) {
  const search = new URLSearchParams(params);
  const response = await fetch(`${graphBaseUrl}/${path}?${search}`, {
    headers: { Authorization: `Bearer ${accessToken()}` },
    cache: 'no-store',
  });
  return parseMetaResponse<T>(response);
}

async function instagramPost<T>(path: string, params: Record<string, string>) {
  const response = await fetch(`${graphBaseUrl}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params),
  });
  return parseMetaResponse<T>(response);
}

export function isInstagramConfigured() {
  return Boolean(process.env.INSTAGRAM_ACCESS_TOKEN);
}

export async function getInstagramProfile(): Promise<InstagramProfile> {
  const profile = await instagramGet<InstagramProfile>('me', {
    fields: 'id,user_id,username',
  });
  const expectedUsername = process.env.INSTAGRAM_USERNAME?.replace(/^@/, '').toLowerCase();
  if (expectedUsername && profile.username.toLowerCase() !== expectedUsername) {
    throw new Error(`The Instagram token belongs to @${profile.username}, not @${expectedUsername}.`);
  }
  return profile;
}

export async function publishInstagramImage(input: {
  imageUrl: string;
  caption: string;
  altText: string;
}): Promise<InstagramPublishResult> {
  const imageUrl = new URL(input.imageUrl);
  if (imageUrl.protocol !== 'https:') throw new Error('Instagram requires a public HTTPS image URL.');

  const profile = await getInstagramProfile();
  const instagramUserId = profile.user_id ?? profile.id;
  const container = await instagramPost<{ id: string }>(`${instagramUserId}/media`, {
    image_url: imageUrl.toString(),
    caption: input.caption,
    alt_text: input.altText,
  });
  if (!container.id) throw new Error('Instagram did not return a media container ID.');

  const published = await instagramPost<{ id: string }>(`${instagramUserId}/media_publish`, {
    creation_id: container.id,
  });
  if (!published.id) throw new Error('Instagram did not return a published media ID.');

  const media = await instagramGet<{ id: string; permalink?: string; timestamp?: string }>(published.id, {
    fields: 'id,permalink,timestamp',
  });

  return {
    mediaId: published.id,
    permalink: media.permalink ?? null,
    publishedAt: media.timestamp ?? new Date().toISOString(),
    username: profile.username,
    providerResponse: { container, published, media },
  };
}
