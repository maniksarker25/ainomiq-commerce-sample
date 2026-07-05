import { getCreativeLibraryStorageStatus } from '@/lib/creative-library/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    ok: true,
    storage: getCreativeLibraryStorageStatus(),
  });
}
