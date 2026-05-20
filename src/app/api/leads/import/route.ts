import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';

// POST /api/leads/import
// Accepts JSON body: { leads: Array<{ companyName, contactName, email?, phone?, source?, notes? }> }
// Creates leads with stage = new_lead, owner = current user
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // VA and sales roles can import
    const allowedRoles = ['admin', 'sales', 'va'];
    if (!allowedRoles.includes(session.user.role ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

    const { leads } = body;
    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json({ error: 'leads array is required and must not be empty' }, { status: 400 });
    }

    if (leads.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 leads per import' }, { status: 400 });
    }

    const VALID_SOURCES = [
      'cold_call', 'cold_email', 'referral', 'website',
      'mark_walker', 'direct_mail', 'other',
    ];

    const rows = leads.map((row: Record<string, string>, idx: number) => {
      const companyName = (row.companyName || row.company_name || row['Company Name'] || row['Company'] || row['company'] || '').trim();

      // Support split first/last name columns (Apollo export format)
      const firstName = (row['First Name'] || row['first_name'] || '').trim();
      const lastName = (row['Last Name'] || row['last_name'] || '').trim();
      const combinedName = [firstName, lastName].filter(Boolean).join(' ');
      const contactName = (row.contactName || row.contact_name || row['Contact Name'] || row['contact'] || combinedName || '').trim();

      if (!companyName) throw new Error(`Row ${idx + 1}: companyName is required`);
      // contactName is nullable — Apollo company-level exports may not have a contact

      const rawSource = (row.source || row['Source'] || 'cold_call').toLowerCase().replace(/\s+/g, '_');
      const source = VALID_SOURCES.includes(rawSource) ? rawSource : 'cold_call';

      // Apollo phone columns: Work Direct Phone, Corporate Phone, Mobile Phone, Home Phone
      const phone = (
        row.phone || row['Phone'] || row.contactPhone ||
        row['Work Direct Phone'] || row['Corporate Phone'] ||
        row['Mobile Phone'] || row['Home Phone'] || row['Other Phone'] || ''
      ).replace(/^'+/, '').trim(); // Apollo sometimes prefixes with ' to prevent Excel formatting

      return {
        companyName,
        contactName: contactName || null,
        email: (row.email || row['Email'] || row.contactEmail || '').trim() || null,
        phone: phone || null,
        source: source as never,
        stage: 'new_lead' as never,
        ownerId: session.user.id,
        notes: (row.notes || row['Notes'] || '').trim() || null,
        sector: (row.sector || row['Sector'] || row['Industry'] || '').trim() || null,
        stageChangedAt: new Date(),
      };
    });

    const created = await prisma.lead.createMany({
      data: rows,
      skipDuplicates: false,
    });

    return NextResponse.json({ imported: created.count }, { status: 201 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Import failed';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
