import { requireAdminApi } from '../../../lib/auth';
import { runFareScan } from '../../../lib/scanner';

export async function POST() {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  try {
    return Response.json(await runFareScan());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The fare scan failed.';
    return Response.json({ error: message }, { status: 500 });
  }
}
