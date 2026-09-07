import { requireAdminApi } from '../../../../lib/auth';
import { getInstagramProfile, isInstagramConfigured } from '../../../../lib/instagram';

export async function GET() {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;
  if (!isInstagramConfigured()) {
    return Response.json({ connected: false, username: 'bayflightdeals' });
  }

  try {
    const profile = await getInstagramProfile();
    return Response.json({
      connected: true,
      username: profile.username,
    });
  } catch (error) {
    return Response.json({
      connected: false,
      username: 'bayflightdeals',
      error: error instanceof Error ? error.message : 'Instagram connection check failed.',
    });
  }
}
