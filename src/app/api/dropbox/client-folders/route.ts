export const runtime = 'nodejs';

import { auth } from '@/lib/auth';

const BASE_PATH = '/Signature Cleans (1)/Signature Cleans - Exeter & Newton Abbot/Contract Cleaning Clients';

// Folders to exclude from the picker (internal/admin folders)
const EXCLUDE = new Set([
  "T&C's Contracts templates",
  'Templates & Internal Docs',
  '_Unsorted',
  '_Unresolved',
  'Nick Stentiford',
]);

async function getDropboxToken(): Promise<string> {
  const appKey = process.env.DROPBOX_APP_KEY!;
  const appSecret = process.env.DROPBOX_APP_SECRET!;
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN!;

  const authHeader = Buffer.from(`${appKey}:${appSecret}`).toString('base64');
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  const json = await res.json() as { access_token?: string; error?: string };
  if (!json.access_token) throw new Error(`Dropbox token error: ${json.error}`);
  return json.access_token;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const token = await getDropboxToken();

    const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: BASE_PATH, recursive: false }),
    });

    if (!res.ok) {
      const err = await res.text();
      return Response.json({ error: 'Dropbox error', detail: err }, { status: 502 });
    }

    const data = await res.json() as {
      entries: Array<{ '.tag': string; name: string; path_display: string }>;
    };

    const folders = data.entries
      .filter((e) => e['.tag'] === 'folder' && !EXCLUDE.has(e.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => ({
        name: e.name,
        path: e.path_display,
      }));

    return Response.json({ folders, basePath: BASE_PATH });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 502 });
  }
}
