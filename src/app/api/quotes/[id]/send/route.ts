import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getSmtpConfig } from '@/lib/smtp';
import { readFileSync, existsSync } from 'fs';
import * as nodemailer from 'nodemailer';

// POST /api/quotes/[id]/send - Send quote email to client
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Allow overriding subject from the preview editor (HTML is always server-generated)
    const { subject: overrideSubject } = body;

    // Fetch the quote
    const quote = await prisma.quote.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        contactEmail: true,
        contactName: true,
        companyName: true,
        emailSubject: true,
        emailHtml: true,
        pdfPath: true,
        trackingId: true,
        isPilot: true,
        createdBy: true,
      },
    });

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (quote.createdBy !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (quote.status !== 'draft') {
      return NextResponse.json({ error: 'Quote already sent' }, { status: 400 });
    }

    if (!quote.contactEmail) {
      return NextResponse.json({ error: 'No contact email on quote' }, { status: 400 });
    }

    const emailSubject = overrideSubject || quote.emailSubject;
    const emailHtml = quote.emailHtml;  // Always use server-generated HTML

    if (!emailSubject || !emailHtml) {
      return NextResponse.json({ error: 'Quote has no email content. Regenerate the quote.' }, { status: 400 });
    }

    // Read PDF attachment (required)
    const pdfFilename = `Signature Cleans T&C's and quote letter (${quote.companyName}).pdf`;
    if (!quote.pdfPath || !existsSync(quote.pdfPath)) {
      return NextResponse.json({ error: 'PDF not found. Please regenerate the quote.' }, { status: 400 });
    }
    const pdfBuffer = readFileSync(quote.pdfPath);

    // SMTP config - use nick@signature-cleans.co.uk
    // For now, use env vars. In production, pull from DB email accounts.
    const smtpUser = process.env.SMTP_USER || 'nick@signature-cleans.co.uk';
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpPass) {
      return NextResponse.json({ error: 'SMTP not configured. Set SMTP_PASS in environment.' }, { status: 500 });
    }

    const config = getSmtpConfig(smtpUser, smtpPass);

    const isTest = quote.contactEmail === 'nelson@signature-cleans.co.uk' &&
      (quote.companyName?.toLowerCase().includes('test') || false);

    // Prepare nodemailer-compatible options with attachment
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: false,
      auth: { user: config.user, pass: config.pass },
    });

    // Send client email
    const clientMailOptions: Record<string, unknown> = {
      from: '"Nick Stentiford" <nick@signature-cleans.co.uk>',
      to: quote.contactEmail,
      cc: isTest ? undefined : 'nelson@signature-cleans.co.uk',
      bcc: isTest ? undefined : 'nick@signature-cleans.co.uk',
      replyTo: 'nick@signature-cleans.co.uk',
      subject: emailSubject,
      html: emailHtml,
      attachments: pdfBuffer ? [{
        filename: pdfFilename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      }] : [],
    };

    await transporter.sendMail(clientMailOptions);

    // Update quote status
    await prisma.quote.update({
      where: { id },
      data: {
        status: 'sent',
        sentAt: new Date(),
        // Store any edits the user made
        emailSubject: emailSubject,
        emailHtml: emailHtml,
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        userId: session.user.id,
        type: 'quote_sent',
        title: 'Quote Sent',
        message: `Quote ${quote.trackingId} sent to ${quote.contactEmail}`,
      },
    });

    return NextResponse.json({
      success: true,
      quote_id: quote.id,
      sent_to: quote.contactEmail,
      quote_ref: quote.trackingId,
    });
  } catch (error) {
    console.error('Quote send error:', error);
    return NextResponse.json({ error: 'Failed to send quote' }, { status: 500 });
  }
}
