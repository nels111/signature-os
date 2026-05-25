/**
 * Dropbox Hours Sheet reader for Signature Cleans OS.
 *
 * Reads the Regular Hours Sheet from Dropbox, parses the xlsx,
 * and returns structured contract data.
 *
 * Creds loaded from DROPBOX_APP_KEY / DROPBOX_APP_SECRET / DROPBOX_REFRESH_TOKEN env vars.
 */

interface DropboxCreds {
  appKey: string;
  appSecret: string;
  refreshToken: string;
}

interface ContractRow {
  name: string;
  cleanType: string;
  hoursPerVisit: number;
  frequencyPerWeek: number;
  weeklyHours: number;
  weeklyEarnings: number;
  monthlyEarnings: number;
  signedTerms: boolean;
  annualValue: number;
  firstAuditDate: string | null;
  status: 'active' | 'pipeline';
}

export interface HoursSheetData {
  contracts: ContractRow[];
  totals: {
    activeContracts: number;
    pipelineContracts: number;
    weeklyHours: number;
    weeklyEarnings: number;
    monthlyEarnings: number;
    annualValue: number;
  };
  fetchedAt: string;
}

function loadDropboxCreds(): DropboxCreds {
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
  if (!appKey || !appSecret || !refreshToken) {
    throw new Error('Missing Dropbox credentials in environment (DROPBOX_APP_KEY / DROPBOX_APP_SECRET / DROPBOX_REFRESH_TOKEN)');
  }
  return { appKey, appSecret, refreshToken };
}

async function getDropboxToken(creds: DropboxCreds): Promise<string> {
  const auth = Buffer.from(`${creds.appKey}:${creds.appSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: creds.refreshToken,
  });

  const res = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`,
    },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`Dropbox token error: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function downloadFile(token: string, filePath: string): Promise<Buffer> {
  const res = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({ path: filePath }),
    },
  });

  if (!res.ok) throw new Error(`Dropbox download error: ${res.status}`);
  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

function parseExcelDate(serial: number): string | null {
  if (!serial || typeof serial !== 'number') return null;
  // Excel date serial to JS date
  const epoch = new Date(1899, 11, 30);
  const date = new Date(epoch.getTime() + serial * 86400000);
  return date.toISOString().split('T')[0];
}

export async function fetchHoursSheet(): Promise<HoursSheetData> {
  // Dynamic import for xlsx (ESM compat)
  const XLSX = await import('xlsx');

  const creds = loadDropboxCreds();
  const token = await getDropboxToken(creds);
  const sheetPath = process.env.DROPBOX_HOURS_SHEET_PATH
    || '/Signature Cleans (1)/Signature Cleans - Exeter & Newton Abbot/Financial Projections/Regular Hours Sheet 2025.xlsx';

  const buffer = await downloadFile(token, sheetPath);
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const ws = workbook.Sheets[workbook.SheetNames[0]];

  const contracts: ContractRow[] = [];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:K39');

  for (let r = 3; r <= range.e.r; r++) { // rows 4+ (0-indexed row 3+)
    const nameCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
    const name = nameCell?.v;
    if (!name || typeof name !== 'string') continue;
    if (name.toLowerCase().includes('total')) continue;

    const hoursPerVisit = ws[XLSX.utils.encode_cell({ r, c: 2 })]?.v ?? 0;
    const freq = ws[XLSX.utils.encode_cell({ r, c: 3 })]?.v ?? 0;
    const weeklyHours = ws[XLSX.utils.encode_cell({ r, c: 4 })]?.v ?? 0;
    const weeklyEarnings = ws[XLSX.utils.encode_cell({ r, c: 5 })]?.v ?? 0;
    const monthlyEarnings = ws[XLSX.utils.encode_cell({ r, c: 6 })]?.v ?? 0;
    const signedTerms = (ws[XLSX.utils.encode_cell({ r, c: 7 })]?.v || '').toString().toLowerCase() === 'yes';
    const annualValue = ws[XLSX.utils.encode_cell({ r, c: 8 })]?.v ?? 0;
    
    const auditCell = ws[XLSX.utils.encode_cell({ r, c: 9 })];
    let firstAuditDate: string | null = null;
    if (auditCell?.v) {
      if (auditCell.v instanceof Date) {
        firstAuditDate = auditCell.v.toISOString().split('T')[0];
      } else if (typeof auditCell.v === 'number') {
        firstAuditDate = parseExcelDate(auditCell.v);
      }
    }

    const isActive = weeklyHours > 0;

    contracts.push({
      name: name.trim(),
      cleanType: (ws[XLSX.utils.encode_cell({ r, c: 1 })]?.v || '').toString().trim(),
      hoursPerVisit: Number(hoursPerVisit) || 0,
      frequencyPerWeek: Number(freq) || 0,
      weeklyHours: Number(weeklyHours) || 0,
      weeklyEarnings: Number(weeklyEarnings) || 0,
      monthlyEarnings: Number(monthlyEarnings) || 0,
      signedTerms,
      annualValue: Number(annualValue) || 0,
      firstAuditDate,
      status: isActive ? 'active' : 'pipeline',
    });
  }

  const active = contracts.filter(c => c.status === 'active');
  const pipeline = contracts.filter(c => c.status === 'pipeline');

  return {
    contracts,
    totals: {
      activeContracts: active.length,
      pipelineContracts: pipeline.length,
      weeklyHours: active.reduce((s, c) => s + c.weeklyHours, 0),
      weeklyEarnings: active.reduce((s, c) => s + c.weeklyEarnings, 0),
      monthlyEarnings: active.reduce((s, c) => s + c.monthlyEarnings, 0),
      annualValue: active.reduce((s, c) => s + c.annualValue, 0),
    },
    fetchedAt: new Date().toISOString(),
  };
}
