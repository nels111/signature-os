export const runtime = 'nodejs';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/role-gate';

async function getDropboxToken(): Promise<string> {
  const appKey = process.env.DROPBOX_APP_KEY!;
  const appSecret = process.env.DROPBOX_APP_SECRET!;
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN!;

  const auth = Buffer.from(`${appKey}:${appSecret}`).toString('base64');
  const res = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  const json = await res.json() as { access_token?: string; error?: string };
  if (!json.access_token) throw new Error(`Dropbox token error: ${json.error}`);
  return json.access_token;
}

interface DropboxEntry {
  '.tag': 'file' | 'folder';
  name: string;
  path_lower: string;
  path_display: string;
  id: string;
  size?: number;
  server_modified?: string;
  client_modified?: string;
}

async function listFolder(token: string, path: string): Promise<DropboxEntry[]> {
  const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: path === '' ? '' : path, recursive: false }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Dropbox list_folder failed: ${err}`);
  }
  const json = await res.json() as { entries: DropboxEntry[]; has_more: boolean; cursor: string };

  let entries = json.entries;

  // Handle pagination (shouldn't be needed for client folders but be safe)
  let cursor = json.cursor;
  let hasMore = json.has_more;
  while (hasMore) {
    const contRes = await fetch('https://api.dropboxapi.com/2/files/list_folder/continue', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ cursor }),
    });
    const contJson = await contRes.json() as { entries: DropboxEntry[]; has_more: boolean; cursor: string };
    entries = [...entries, ...contJson.entries];
    cursor = contJson.cursor;
    hasMore = contJson.has_more;
  }

  return entries;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  await requireRole(['admin', 'sales', 'operations']);

  const { id } = await params;

  const client = await prisma.clientAccount.findUnique({
    where: { id },
    select: { dropboxFolderPath: true, contactName: true },
  });

  if (!client) return Response.json({ error: 'Not found' }, { status: 404 });
  if (!client.dropboxFolderPath) {
    return Response.json({ entries: [], warning: 'No Dropbox folder configured for this client' });
  }

  const url = new URL(request.url);
  // Allow drilling into subfolders: ?path= is relative to the client root
  const subPath = url.searchParams.get('path') || '';
  const targetPath = subPath ? `${client.dropboxFolderPath}/${subPath}`.replace(/\/+/g, '/') : client.dropboxFolderPath;

  try {
    const token = await getDropboxToken();
    const entries = await listFolder(token, targetPath);

    // Sort: folders first, then files by modified date desc
    const sorted = entries.sort((a, b) => {
      if (a['.tag'] !== b['.tag']) return a['.tag'] === 'folder' ? -1 : 1;
      const aDate = a.server_modified ?? '';
      const bDate = b.server_modified ?? '';
      return bDate.localeCompare(aDate);
    });

    return Response.json({
      folderPath: targetPath,
      rootPath: client.dropboxFolderPath,
      entries: sorted.map((e) => ({
        type: e['.tag'],
        name: e.name,
        pathDisplay: e.path_display,
        // Relative path from client root for navigation
        relativePath: e.path_display.replace(client.dropboxFolderPath!, '').replace(/^\//, ''),
        size: e.size,
        modified: e.server_modified,
        id: e.id,
      })),
    });
  } catch (err) {
    console.error('[dropbox-folder]', err);
    return Response.json({ error: 'Failed to fetch Dropbox folder', detail: String(err) }, { status: 502 });
  }
}
