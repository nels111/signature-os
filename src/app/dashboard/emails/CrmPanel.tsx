"use client";

import { useState, useEffect } from "react";
import { ExternalLink, User, Tag, Briefcase, Phone, Mail, Link2, Unlink } from "lucide-react";

interface CrmContext {
  contact: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    company: string | null;
  } | null;
  lead: {
    id: string;
    companyName: string;
    contactName: string;
    email: string | null;
    phone: string | null;
    stage: string;
  } | null;
  deal: {
    id: string;
    name: string;
    stage: string;
    value: number | null;
  } | null;
}

interface CrmPanelProps {
  emailIds: string[];
}

const DEAL_STAGE_LABELS: Record<string, string> = {
  quote_sent: "Quote Sent",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
  on_hold: "On Hold",
};

const DEAL_STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  quote_sent: { bg: "#E8F0FE", text: "#2056A4" },
  negotiation: { bg: "#FEF3E8", text: "#A45200" },
  won: { bg: "#E6F4EA", text: "#137333" },
  lost: { bg: "#FCE8E8", text: "#C5221F" },
  on_hold: { bg: "#F1F3F4", text: "#5F6368" },
};

const LEAD_STAGE_LABELS: Record<string, string> = {
  cold_call: "Cold Call",
  cold_email: "Cold Email",
  meeting_booked: "Meeting Booked",
  proposal_sent: "Proposal Sent",
  negotiating: "Negotiating",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 50%, 42%)`;
}

export function CrmPanel({ emailIds }: CrmPanelProps) {
  const [context, setContext] = useState<CrmContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastFetchedId, setLastFetchedId] = useState<string | null>(null);

  useEffect(() => {
    if (!emailIds || emailIds.length === 0) {
      setContext(null);
      setLastFetchedId(null);
      return;
    }

    const targetId = emailIds[0];
    if (targetId === lastFetchedId) return;

    setLastFetchedId(targetId);
    setLoading(true);

    fetch(`/api/emails/${targetId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.email) {
          setContext({
            contact: data.email.linkedContact ?? null,
            lead: data.email.linkedLead ?? null,
            deal: data.email.linkedDeal ?? null,
          });
        } else {
          setContext(null);
        }
      })
      .catch(() => setContext(null))
      .finally(() => setLoading(false));
  }, [emailIds, lastFetchedId]);

  const hasContext = context && (context.contact || context.lead || context.deal);

  return (
    <div
      style={{
        width: "240px",
        flexShrink: 0,
        borderLeft: "1px solid var(--border)",
        backgroundColor: "var(--background)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px 10px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          flexShrink: 0,
        }}
      >
        <Link2 size={12} style={{ color: "var(--text-muted)" }} />
        <span
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--text-muted)",
          }}
        >
          CRM Context
        </span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {[80, 60, 70].map((w, i) => (
              <div
                key={i}
                style={{
                  height: "12px",
                  borderRadius: "6px",
                  width: `${w}%`,
                  backgroundColor: "var(--border)",
                  animation: "crm-pulse 1.5s ease-in-out infinite",
                }}
              />
            ))}
          </div>
        ) : !emailIds.length ? (
          <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", marginTop: "32px" }}>
            Select an email to see CRM context
          </p>
        ) : !hasContext ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", marginTop: "32px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                backgroundColor: "var(--border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Unlink size={16} style={{ color: "var(--text-muted)" }} />
            </div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5 }}>
              No CRM record linked
            </p>
            <p style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", lineHeight: 1.5 }}>
              Add the sender to Contacts or Leads to auto-link on next sync
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

            {context.contact && (
              <div
                style={{
                  backgroundColor: "var(--surface)",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  padding: "11px 12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "8px" }}>
                  <User size={10} style={{ color: "var(--brand-blue)", flexShrink: 0 }} />
                  <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--brand-blue)" }}>
                    Contact
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <div
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "50%",
                      flexShrink: 0,
                      backgroundColor: hashColor(`${context.contact.firstName} ${context.contact.lastName}`),
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    {context.contact.firstName[0]}{context.contact.lastName[0]}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {context.contact.firstName} {context.contact.lastName}
                    </div>
                    {context.contact.company && (
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {context.contact.company}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px", marginBottom: "9px" }}>
                  {context.contact.email && (
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <Mail size={10} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                      <span style={{ fontSize: "11px", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {context.contact.email}
                      </span>
                    </div>
                  )}
                  {context.contact.phone && (
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      <Phone size={10} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                      <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                        {context.contact.phone}
                      </span>
                    </div>
                  )}
                </div>
                <a
                  href={`/dashboard/contacts?id=${context.contact.id}`}
                  style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 600, color: "var(--brand-blue)", textDecoration: "none" }}
                >
                  Open Contact <ExternalLink size={10} />
                </a>
              </div>
            )}

            {context.lead && (
              <div
                style={{
                  backgroundColor: "var(--surface)",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  padding: "11px 12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "8px" }}>
                  <Tag size={10} style={{ color: "#FF9500", flexShrink: 0 }} />
                  <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#FF9500" }}>
                    Lead
                  </span>
                </div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "2px" }}>
                  {context.lead.companyName}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "7px" }}>
                  {context.lead.contactName}
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    fontSize: "10px",
                    fontWeight: 600,
                    padding: "2px 7px",
                    borderRadius: "20px",
                    marginBottom: "9px",
                    backgroundColor: "#FEF3E8",
                    color: "#A45200",
                  }}
                >
                  {LEAD_STAGE_LABELS[context.lead.stage] || context.lead.stage}
                </div>
                <div />
                <a
                  href={`/dashboard/leads?id=${context.lead.id}`}
                  style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 600, color: "var(--brand-blue)", textDecoration: "none" }}
                >
                  Open Lead <ExternalLink size={10} />
                </a>
              </div>
            )}

            {context.deal && (
              <div
                style={{
                  backgroundColor: "var(--surface)",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  padding: "11px 12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "8px" }}>
                  <Briefcase size={10} style={{ color: "#7627BB", flexShrink: 0 }} />
                  <span style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "#7627BB" }}>
                    Deal
                  </span>
                </div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "4px" }}>
                  {context.deal.name}
                </div>
                {context.deal.value != null && (
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "5px" }}>
                    £{context.deal.value.toLocaleString()}
                  </div>
                )}
                <div
                  style={{
                    display: "inline-flex",
                    fontSize: "10px",
                    fontWeight: 600,
                    padding: "2px 7px",
                    borderRadius: "20px",
                    marginBottom: "9px",
                    backgroundColor: DEAL_STAGE_COLORS[context.deal.stage]?.bg ?? "#F1F3F4",
                    color: DEAL_STAGE_COLORS[context.deal.stage]?.text ?? "#5F6368",
                  }}
                >
                  {DEAL_STAGE_LABELS[context.deal.stage] || context.deal.stage}
                </div>
                <div />
                <a
                  href={`/dashboard/deals?id=${context.deal.id}`}
                  style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: 600, color: "var(--brand-blue)", textDecoration: "none" }}
                >
                  Open Deal <ExternalLink size={10} />
                </a>
              </div>
            )}

          </div>
        )}
      </div>

      <style>{`
        @keyframes crm-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
