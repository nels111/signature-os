/**
 * Audit PDF generation + Dropbox upload for Signature Cleans OS.
 *
 * On publish, we render a clean A4 summary of the audit with pdf-lib (pure JS,
 * no native deps) and upload it to the client's Dropbox folder under:
 *   <dropboxFolderPath>/Client Folder/Audits/<SiteName>/<filename>.pdf
 *
 * Cleaning hours are NEVER included. Brand is "Signature Cleans".
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

export interface AuditScoredCategory {
  key: string;
  label: string;
  score: number;
  note?: string;
}

export interface AuditPdfInput {
  siteName: string;
  clientName: string | null;
  auditorName: string | null;
  auditedAt: Date;
  formType: string; // 'small' | 'large'
  siteVariant: string | null;
  categories: AuditScoredCategory[];
  rawScore: number;
  maxScore: number;
  overallScore: number;
  binsEmptied: boolean | null;
  issuesSpotted: string | null;
  needsReview: string | null;
  headlineNotes: string | null;
  /** Base64 data URLs, e.g. "data:image/jpeg;base64,..." */
  photos: string[];
  /** Base64 data URL, e.g. "data:image/png;base64,..." */
  signatureData?: string | null;
}

// Brand palette (mirrors the app status tokens).
const GREEN = rgb(0.086, 0.639, 0.29);
const AMBER = rgb(0.851, 0.467, 0.024);
const RED = rgb(0.863, 0.149, 0.149);
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.42, 0.42, 0.47);
const LINE = rgb(0.88, 0.88, 0.9);
const BRAND = rgb(0.125, 0.337, 0.643); // #2056A4

function bandColor(score: number) {
  if (score >= 80) return GREEN;
  if (score >= 70) return AMBER;
  return RED;
}
function bandLabel(score: number): string {
  if (score >= 80) return 'Healthy';
  if (score >= 70) return 'Attention';
  return 'At risk';
}

// Strip characters StandardFonts (WinAnsi) cannot encode so pdf-lib never throws.
function sanitize(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
}

// Greedy word-wrap to a max width at a given font size.
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const rawLine of sanitize(text).split('\n')) {
    const words = rawLine.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

/**
 * Decode a base64 data URL into bytes + detected mime kind.
 * Returns null if the string isn't a usable image data URL.
 */
function decodeImageDataUrl(
  dataUrl: string,
): { bytes: Uint8Array; kind: 'jpg' | 'png' } | null {
  if (typeof dataUrl !== 'string') return null;
  const match = /^data:(image\/[a-zA-Z0-9.+-]+)?;base64,([\s\S]+)$/.exec(dataUrl.trim());
  if (!match) return null;
  const mime = (match[1] || '').toLowerCase();
  const base64 = match[2].replace(/\s/g, '');
  let kind: 'jpg' | 'png';
  if (mime.includes('png')) kind = 'png';
  else if (mime.includes('jpeg') || mime.includes('jpg')) kind = 'jpg';
  else {
    // Fall back to magic-byte sniffing when the mime is missing/odd.
    const head = base64.slice(0, 8);
    kind = head.startsWith('iVBOR') ? 'png' : 'jpg';
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(Buffer.from(base64, 'base64'));
  } catch {
    return null;
  }
  if (bytes.length === 0) return null;
  return { bytes, kind };
}

export async function generateAuditPdf(input: AuditPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Embed the real Signature Cleans badge logo for the header (fall back gracefully).
  let logoImg: Awaited<ReturnType<typeof doc.embedJpg>> | null = null;
  try {
    const fs = await import('fs');
    const candidates = [
      `${process.cwd()}/public/logo-badge.jpg`,
      '/var/www/signature-cleans-os/public/logo-badge.jpg',
    ];
    for (const p of candidates) {
      try {
        const buf = fs.readFileSync(p);
        logoImg = await doc.embedJpg(new Uint8Array(buf));
        break;
      } catch { /* try next path */ }
    }
  } catch { /* no logo — header falls back to text only */ }

  const PAGE_W = 595.28; // A4
  const PAGE_H = 841.89;
  const MARGIN = 48;
  const CONTENT_W = PAGE_W - MARGIN * 2;

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const newPage = () => {
    page = doc.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - MARGIN;
  };
  const ensure = (needed: number) => {
    if (y - needed < MARGIN) newPage();
  };
  const text = (
    s: string,
    x: number,
    size: number,
    f: PDFFont,
    color = INK,
  ) => {
    page.drawText(sanitize(s), { x, y, size, font: f, color });
  };

  // ---- Header band ----
  page.drawRectangle({ x: 0, y: PAGE_H - 96, width: PAGE_W, height: 96, color: BRAND });
  let headerTextX = MARGIN;
  if (logoImg) {
    const logoSize = 54;
    // White rounded backdrop so the badge reads cleanly on the navy band.
    page.drawCircle({ x: MARGIN + logoSize / 2, y: PAGE_H - 48, size: logoSize / 2 + 3, color: rgb(1, 1, 1) });
    page.drawImage(logoImg, { x: MARGIN, y: PAGE_H - 48 - logoSize / 2, width: logoSize, height: logoSize });
    headerTextX = MARGIN + logoSize + 16;
  }
  page.drawText('Signature Cleans', {
    x: headerTextX, y: PAGE_H - 44, size: 20, font: bold, color: rgb(1, 1, 1),
  });
  page.drawText('Site Audit', {
    x: headerTextX, y: PAGE_H - 66, size: 12, font, color: rgb(0.85, 0.9, 1),
  });
  y = PAGE_H - 96 - 28;

  // ---- Meta block ----
  const auditTypeLabel =
    input.formType === 'small'
      ? 'Small Site Audit'
      : input.siteVariant === 'crave'
        ? 'Large Site Audit (Crave)'
        : input.siteVariant === 'porsche_showroom'
          ? 'Large Site Audit (Porsche Showroom)'
          : 'Large Site Audit';

  text(input.siteName, MARGIN, 16, bold, INK);
  y -= 20;
  if (input.clientName) {
    text(`Client: ${input.clientName}`, MARGIN, 10, font, MUTED);
    y -= 14;
  }
  const dateStr = input.auditedAt.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  text(`Date: ${dateStr}`, MARGIN, 10, font, MUTED);
  y -= 14;
  text(`Auditor: ${input.auditorName ?? 'Signature Cleans'}`, MARGIN, 10, font, MUTED);
  y -= 14;
  text(`Audit type: ${auditTypeLabel}`, MARGIN, 10, font, MUTED);
  y -= 24;

  // ---- Overall score box ----
  const boxH = 64;
  ensure(boxH + 12);
  const bc = bandColor(input.overallScore);
  page.drawRectangle({
    x: MARGIN, y: y - boxH, width: CONTENT_W, height: boxH,
    color: rgb(0.97, 0.97, 0.98), borderColor: LINE, borderWidth: 1,
  });
  page.drawText('OVERALL SCORE', { x: MARGIN + 16, y: y - 22, size: 9, font: bold, color: MUTED });
  page.drawText(`${input.overallScore}`, { x: MARGIN + 16, y: y - 50, size: 26, font: bold, color: bc });
  const slashW = bold.widthOfTextAtSize(`${input.overallScore}`, 26);
  page.drawText('/100', { x: MARGIN + 16 + slashW + 4, y: y - 50, size: 12, font, color: MUTED });
  page.drawText(`${input.rawScore}/${input.maxScore} raw`, { x: MARGIN + 16 + slashW + 44, y: y - 48, size: 9, font, color: MUTED });
  // Band pill on the right
  const pill = bandLabel(input.overallScore);
  const pillW = bold.widthOfTextAtSize(pill, 10) + 20;
  page.drawRectangle({
    x: MARGIN + CONTENT_W - pillW - 16, y: y - 40, width: pillW, height: 22,
    color: rgb(1, 1, 1), borderColor: bc, borderWidth: 1.2,
  });
  page.drawText(pill, { x: MARGIN + CONTENT_W - pillW - 16 + 10, y: y - 34, size: 10, font: bold, color: bc });
  y -= boxH + 26;

  // ---- Section heading helper ----
  const heading = (label: string) => {
    ensure(28);
    text(label, MARGIN, 12, bold, BRAND);
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y: y - 2 }, end: { x: MARGIN + CONTENT_W, y: y - 2 }, thickness: 1, color: LINE });
    y -= 16;
  };

  // ---- Category scores ----
  heading('Category Scores');
  // Layout: [ label ............ ][ gradient bar ][ X/10 ]
  const SCORE_W = 42; // right column for "10/10"
  const LABEL_W = 168; // left column for the category label
  const BAR_X = MARGIN + LABEL_W + 8;
  const BAR_W = CONTENT_W - LABEL_W - SCORE_W - 16;
  const BAR_H = 9;
  const GRAD_SEGMENTS = 24; // amber -> green steps
  for (const c of input.categories) {
    ensure(20);
    const clamped = Math.max(0, Math.min(10, c.score));
    const frac = clamped / 10;
    const cScore = `${c.score}/10`;
    const cColor = c.score >= 8 ? GREEN : c.score >= 6 ? AMBER : RED;
    const rowMid = y - 8; // vertical centre of this row's bar

    // Label (left, vertically aligned with bar centre)
    page.drawText(sanitize(c.label), { x: MARGIN, y: rowMid - 3, size: 10, font, color: INK });

    // Track (full width, light grey rounded)
    page.drawRectangle({
      x: BAR_X, y: rowMid - BAR_H / 2, width: BAR_W, height: BAR_H,
      color: rgb(0.91, 0.92, 0.94),
    });
    // Gradient fill amber -> green, clipped to the filled fraction.
    const fillW = BAR_W * frac;
    if (fillW > 0.5) {
      const segW = BAR_W / GRAD_SEGMENTS;
      for (let s = 0; s < GRAD_SEGMENTS; s++) {
        const segX = BAR_X + s * segW;
        if (segX >= BAR_X + fillW) break;
        const drawW = Math.min(segW, BAR_X + fillW - segX);
        const t = s / (GRAD_SEGMENTS - 1);
        // amber #D97706 -> green #16A34A
        const r = 0.851 + (0.086 - 0.851) * t;
        const g = 0.467 + (0.639 - 0.467) * t;
        const b = 0.024 + (0.29 - 0.024) * t;
        page.drawRectangle({
          x: segX, y: rowMid - BAR_H / 2, width: drawW, height: BAR_H,
          color: rgb(r, g, b),
        });
      }
    }

    // Score (right)
    const sw = bold.widthOfTextAtSize(cScore, 10);
    page.drawText(cScore, { x: MARGIN + CONTENT_W - sw, y: rowMid - 3, size: 10, font: bold, color: cColor });
    y -= 18;

    if (c.note) {
      const noteLines = wrapText(c.note, font, 9, CONTENT_W - 16);
      for (const nl of noteLines) {
        ensure(13);
        text(nl, MARGIN + 12, 9, font, MUTED);
        y -= 12;
      }
      y -= 2;
    }
  }
  y -= 10;

  // ---- Operational checks ----
  heading('Operational Checks');
  const binsTxt = input.binsEmptied === null ? 'Not recorded' : input.binsEmptied ? 'Yes' : 'No';
  ensure(16);
  text('Bins emptied:', MARGIN, 10, bold, INK);
  text(binsTxt, MARGIN + 90, 10, font, INK);
  y -= 18;

  const block = (label: string, value: string | null) => {
    if (!value || !value.trim()) return;
    ensure(18);
    text(label, MARGIN, 10, bold, INK);
    y -= 14;
    for (const ln of wrapText(value, font, 10, CONTENT_W)) {
      ensure(14);
      text(ln, MARGIN, 10, font, rgb(0.2, 0.2, 0.24));
      y -= 13;
    }
    y -= 8;
  };
  block('Issues spotted', input.issuesSpotted);
  block('Needs review / actions by next audit', input.needsReview);
  block('Headline notes', input.headlineNotes);

  // ---- Photos (embedded grid) ----
  const photos = Array.isArray(input.photos) ? input.photos : [];
  if (photos.length > 0) {
    heading('Photos');

    const COLS = 3;
    const GAP = 12;
    const CELL_W = (CONTENT_W - GAP * (COLS - 1)) / COLS;
    const CELL_H = CELL_W * 0.78; // landscape-ish cell; image fitted inside keeping aspect

    let col = 0;
    let rowTop = y; // top of the current row of cells

    const startRow = () => {
      // Ensure a full cell fits; otherwise move to a new page.
      if (rowTop - CELL_H < MARGIN + 16) {
        newPage();
        rowTop = y;
      }
    };

    startRow();
    for (const dataUrl of photos) {
      try {
        const decoded = decodeImageDataUrl(dataUrl);
        if (!decoded) continue;
        const img =
          decoded.kind === 'png'
            ? await doc.embedPng(decoded.bytes)
            : await doc.embedJpg(decoded.bytes);

        if (col === 0) startRow();

        const cellX = MARGIN + col * (CELL_W + GAP);
        const cellY = rowTop - CELL_H;

        // Scale to fit within the cell, keeping aspect ratio.
        const scale = Math.min(CELL_W / img.width, CELL_H / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const drawX = cellX + (CELL_W - drawW) / 2;
        const drawY = cellY + (CELL_H - drawH) / 2;

        // Light frame around each cell.
        page.drawRectangle({
          x: cellX, y: cellY, width: CELL_W, height: CELL_H,
          color: rgb(0.97, 0.97, 0.98), borderColor: LINE, borderWidth: 0.75,
        });
        page.drawImage(img, { x: drawX, y: drawY, width: drawW, height: drawH });

        col++;
        if (col >= COLS) {
          col = 0;
          rowTop -= CELL_H + GAP;
        }
      } catch (err) {
        // One bad image must not break the whole PDF.
        console.warn('[audit-pdf] Skipping unembeddable photo:', err);
        continue;
      }
    }
    // Advance y past the last (possibly partial) row.
    if (col > 0) rowTop -= CELL_H + GAP;
    y = rowTop - 8;
  }

  // ---- Auditor signature (embedded) ----
  const sigDecoded = input.signatureData ? decodeImageDataUrl(input.signatureData) : null;
  if (sigDecoded) {
    const BOX_W = 220;
    const BOX_H = 90;
    ensure(BOX_H + 36);
    heading('Auditor Signature');
    const boxY = y - BOX_H;
    page.drawRectangle({
      x: MARGIN, y: boxY, width: BOX_W, height: BOX_H,
      color: rgb(1, 1, 1), borderColor: LINE, borderWidth: 1,
    });
    try {
      // Signatures are PNG; fall back to JPG embed if mis-detected.
      const img =
        sigDecoded.kind === 'png'
          ? await doc.embedPng(sigDecoded.bytes)
          : await doc.embedJpg(sigDecoded.bytes);
      const pad = 8;
      const scale = Math.min((BOX_W - pad * 2) / img.width, (BOX_H - pad * 2) / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      page.drawImage(img, {
        x: MARGIN + (BOX_W - drawW) / 2,
        y: boxY + (BOX_H - drawH) / 2,
        width: drawW,
        height: drawH,
      });
    } catch (err) {
      console.warn('[audit-pdf] Could not embed signature image:', err);
      page.drawText('Signature on record', {
        x: MARGIN + 12, y: boxY + BOX_H / 2 - 4, size: 9, font, color: MUTED,
      });
    }
    if (input.auditorName) {
      page.drawText(sanitize(input.auditorName), {
        x: MARGIN, y: boxY - 14, size: 9, font, color: MUTED,
      });
    }
    y = boxY - 24;
  }

  // ---- Footer on every page ----
  const pages = doc.getPages();
  const footer = `Signature Cleans - Site Audit - ${input.siteName} - Generated ${new Date().toLocaleDateString('en-GB')}`;
  pages.forEach((p: PDFPage, i: number) => {
    p.drawText(sanitize(footer), { x: MARGIN, y: 24, size: 7.5, font, color: MUTED });
    const pageNum = `${i + 1} / ${pages.length}`;
    const pnw = font.widthOfTextAtSize(pageNum, 7.5);
    p.drawText(pageNum, { x: PAGE_W - MARGIN - pnw, y: 24, size: 7.5, font, color: MUTED });
  });

  return doc.save();
}

// ---------- Dropbox upload ----------

async function getDropboxToken(): Promise<string> {
  const appKey = process.env.DROPBOX_APP_KEY;
  const appSecret = process.env.DROPBOX_APP_SECRET;
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN;
  if (!appKey || !appSecret || !refreshToken) {
    throw new Error('Missing Dropbox credentials');
  }
  const basic = Buffer.from(`${appKey}:${appSecret}`).toString('base64');
  const res = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
  });
  const json = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!json.access_token) {
    throw new Error(`Dropbox token error: ${json.error_description || json.error || res.status}`);
  }
  return json.access_token;
}

// Dropbox filenames: keep it filesystem-safe.
function safeName(s: string): string {
  return sanitize(s).replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
}

export function buildAuditPdfFilename(opts: {
  formType: string;
  auditorName: string | null;
  auditedAt: Date;
}): string {
  const typeLabel = opts.formType === 'small' ? 'Small_Site_Audit' : 'Large_Site_Audit';
  const auditor = safeName(opts.auditorName || 'Signature Cleans').replace(/\s+/g, '_');
  const d = opts.auditedAt;
  const pad = (n: number) => String(n).padStart(2, '0');
  const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const time = `${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${typeLabel}_${auditor}_${date}_${time}.pdf`;
}

/**
 * Resolves the target Dropbox folder and uploads the PDF.
 * Folder convention: <dropboxFolderPath>/Client Folder/Audits/<SiteName>/<filename>.pdf
 * Returns the Dropbox path of the uploaded file.
 */
export async function uploadAuditPdfToDropbox(opts: {
  dropboxFolderPath: string;
  siteName: string;
  filename: string;
  pdf: Uint8Array;
}): Promise<string> {
  const token = await getDropboxToken();

  const folder = `${opts.dropboxFolderPath}/Client Folder/Audits/${safeName(opts.siteName)}`
    .replace(/\/+/g, '/');
  const path = `${folder}/${opts.filename}`.replace(/\/+/g, '/');

  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path,
        mode: 'add',
        autorename: true,
        mute: true,
        strict_conflict: false,
      }),
    },
    // Buffer view of the Uint8Array for fetch body.
    body: Buffer.from(opts.pdf),
  });

  if (!res.ok) {
    const errTxt = await res.text();
    throw new Error(`Dropbox upload failed (${res.status}): ${errTxt}`);
  }

  const json = (await res.json()) as { path_display?: string; path_lower?: string };
  return json.path_display || json.path_lower || path;
}
