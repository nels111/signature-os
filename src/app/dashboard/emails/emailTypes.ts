export interface EmailAttachmentMeta {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  contentId?: string | null;
}

export interface EmailFull {
  id: string;
  messageId: string;
  mailbox: string;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  bodyText: string | null;
  bodyHtml: string | null;
  date: string;
  isRead: boolean;
  folder: string;
  linkedLead: { id: string; companyName: string } | null;
  linkedDeal: { id: string; name: string } | null;
  linkedContact: { id: string; firstName: string; lastName: string } | null;
  attachments?: EmailAttachmentMeta[];
}

export interface EmailDetailProps {
  emailIds: string[];
  onReply: (data: {
    to: string;
    subject: string;
    inReplyTo: string;
    references: string;
    bodyHtml: string;
  }) => void;
  onBack: () => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onMarkRead: (id: string, read: boolean) => void;
  activeFolder?: string;
}
