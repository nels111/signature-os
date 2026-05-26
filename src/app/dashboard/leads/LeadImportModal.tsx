'use client';

import { useState, useRef, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';

interface LeadImportModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

// Proper CSV line parser — handles quoted fields containing commas and escaped quotes
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function LeadImportModal({ open, onClose, onImported }: LeadImportModalProps) {
  const [importStatus, setImportStatus] = useState<'idle' | 'parsing' | 'importing' | 'done' | 'error'>('idle');
  const [importMessage, setImportMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpen = () => {
    setImportStatus('idle');
    setImportMessage('');
  };

  const handleCsvImport = useCallback(async (file: File) => {
    setImportStatus('parsing');
    setImportMessage('');
    try {
      const text = await file.text();
      const cleanText = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const lines = cleanText.trim().split('\n').filter(l => l.trim());
      if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row');

      const HEADER_SIGNALS = ['company name', 'first name', 'last name', 'companyname'];
      let headerLineIdx = 0;
      for (let i = 0; i < Math.min(lines.length, 3); i++) {
        const cells = parseCSVLine(lines[i]).map(c => c.toLowerCase());
        if (HEADER_SIGNALS.some(s => cells.includes(s))) { headerLineIdx = i; break; }
      }
      if (lines.length < headerLineIdx + 2) throw new Error('CSV must have a header row and at least one data row');

      const headers = parseCSVLine(lines[headerLineIdx]);
      const leads = lines.slice(headerLineIdx + 1).filter(l => l.trim()).map(line => {
        const values = parseCSVLine(line);
        const row: Record<string, string> = {};
        headers.forEach((h, i) => { row[h] = values[i] || ''; });
        if (!row['contactName'] && !row['Contact Name'] && (row['First Name'] || row['Last Name'])) {
          row['Contact Name'] = [row['First Name'], row['Last Name']].filter(Boolean).join(' ').trim();
        }
        return row;
      });

      setImportStatus('importing');
      setImportMessage(`Importing ${leads.length} leads...`);

      const res = await fetch('/api/leads/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leads }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');

      setImportStatus('done');
      setImportMessage(`${data.imported} leads imported successfully`);
      onImported();
    } catch (err) {
      setImportStatus('error');
      setImportMessage(err instanceof Error ? err.message : 'Import failed');
    }
  }, [onImported]);

  return (
    <Modal open={open} onClose={onClose} title="Import Leads from CSV" maxWidth="480px">
      <div className="space-y-4">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Upload a CSV file. Apollo exports are supported natively. Required columns: <strong>Company Name</strong>, <strong>Contact Name</strong> (or <strong>First Name</strong> + <strong>Last Name</strong>). Optional: email, phone, industry, notes.
        </p>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          All imported leads will be created with stage: <strong>New Lead</strong>.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleCsvImport(file);
            e.target.value = '';
          }}
        />

        {importStatus === 'idle' && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full py-3 text-sm rounded-lg border-2 border-dashed hover:opacity-80"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
          >
            Click to select CSV file
          </button>
        )}

        {(importStatus === 'parsing' || importStatus === 'importing') && (
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--brand-blue)', borderTopColor: 'transparent' }} />
            {importStatus === 'parsing' ? 'Parsing CSV...' : importMessage}
          </div>
        )}

        {importStatus === 'done' && (
          <div className="space-y-3">
            <p className="text-sm font-medium" style={{ color: '#22c55e' }}>{importMessage}</p>
            <div className="flex gap-2">
              <button
                onClick={() => { setImportStatus('idle'); fileInputRef.current?.click(); }}
                className="flex-1 py-2 text-sm rounded-lg border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
              >
                Import another file
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2 text-sm text-white rounded-lg"
                style={{ backgroundColor: 'var(--brand-blue)' }}
              >
                Done
              </button>
            </div>
          </div>
        )}

        {importStatus === 'error' && (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: '#ef4444' }}>{importMessage}</p>
            <button
              onClick={() => { setImportStatus('idle'); setImportMessage(''); }}
              className="w-full py-2 text-sm rounded-lg border"
              style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
