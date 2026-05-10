# Signature Cleans OS -- Build Progress

**Last Updated:** 2026-05-10 02:30 UTC
**Current Phase:** Phase 9 -- Deploy & Polish (COMPLETE)
**Status:** 🟢 All phases built, audited, hardened

---

## Phase Tracker

| Phase | Status | Audited | Notes |
|-------|--------|---------|-------|
| 0. Spec & Tooling | ✅ done | -- | SPEC.md, git repo, PM2, Codex auth |
| 1. Foundation | ✅ done | ✅ Codex | Schema, auth, layout, dashboard shell, 6 UI components |
| 2. CRM Core | ✅ done | ✅ Codex | Contacts + Accounts CRUD, DataTable, soft-delete |
| 3. Pipeline | ✅ done | ✅ Codex | Leads, Deals, Kanban drag-drop, lead->deal conversion |
| 4. Tasks & Calendar | ✅ done | ✅ Codex | Tasks CRUD, Calendar month view, invites, personal/shared |
| 5. Email Client | ✅ done | ✅ Codex | IMAP/SMTP, two-panel inbox, compose/reply/forward, CRM linking |
| 6. Quote Generator | ✅ done | ✅ Codex | Ported from Vercel, PDF gen (docxtemplater+libreoffice), email draft/preview/send |
| 7. Integrations | ✅ done | ✅ Codex | Fireflies sync, Activity log, Dashboard KPI endpoint |
| 8. Cadence Engine | ✅ done | ✅ Codex | Email sequences (DISABLED by default), templates CRUD, merge fields |
| 9. Deploy & Polish | ✅ done | ✅ Codex | Nginx, SSL, rate limiting, API key auth, error boundaries |

## Architecture

- **Stack:** Next.js 15 (App Router), Prisma 7, PostgreSQL, NextAuth v5
- **Domain:** os.signature-cleans.co.uk (SSL via Let's Encrypt)
- **Port:** 3200 (PM2 managed)
- **DB:** signature_cleans_os on localhost:5432

## API Endpoints

| Module | Endpoints |
|--------|-----------|
| Auth | POST /api/auth/[...nextauth] |
| Contacts | GET/POST /api/contacts, GET/PATCH/DELETE /api/contacts/[id] |
| Accounts | GET/POST /api/accounts, GET/PATCH/DELETE /api/accounts/[id] |
| Leads | GET/POST /api/leads, GET/PATCH/DELETE /api/leads/[id] |
| Deals | GET/POST /api/deals, GET/PATCH/DELETE /api/deals/[id] |
| Tasks | GET/POST /api/tasks, GET/PATCH/DELETE /api/tasks/[id] |
| Calendar | GET/POST /api/calendar, GET/PATCH/DELETE /api/calendar/[id], POST /api/calendar/[id]/invite |
| Emails | GET/POST /api/emails, GET/PATCH /api/emails/[id], POST /api/emails/sync, GET /api/emails/mailboxes |
| Quotes | GET/POST /api/quotes, GET /api/quotes/[id], POST /api/quotes/generate, POST /api/quotes/[id]/send, POST /api/quotes/calculate |
| Fireflies | GET/POST /api/fireflies, GET/PATCH /api/fireflies/[id] |
| Activities | GET/POST /api/activities |
| Dashboard | GET /api/dashboard |
| Cadence | GET /api/cadence, POST /api/cadence/actions |
| Templates | GET/POST /api/email-templates, GET/PATCH/DELETE /api/email-templates/[id] |
| Notifications | GET/POST /api/notifications |

## Jaz API Access

API key auth via Bearer token in Authorization header. Key stored in .env as API_KEY.

```bash
curl -H "Authorization: Bearer $API_KEY" https://os.signature-cleans.co.uk/api/dashboard
```

## Credentials Needed (from Nelson)

- [ ] SMTP_PASS for nick@signature-cleans.co.uk (quote emails)
- [ ] IONOS email passwords for nelson@, nick@, hello@ (IMAP sync)

## Security Hardening Applied

- All P1 findings fixed across all phases
- HTML escaping on all user inputs in email templates
- Rate limiting on login (10/15min), quotes (5/min), email send (10/min)
- Ownership checks on quote send, notification creation
- Prisma transactions on cadence start/pause/resume
- Input validation (types, lengths, ranges) on all POST/PATCH endpoints
- Error details never leaked to client
- Security headers via nginx (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)
- iframe sandbox (empty) on email preview

## Next: Phase 10 -- Design Pass

Full UI redesign of every page. Dedicated session with Nelson for direction.
