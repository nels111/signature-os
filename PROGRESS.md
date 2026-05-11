# Signature Cleans OS -- Build Progress

**Last Updated:** 2026-05-10 13:15 UTC
**Current Phase:** Phase 10 -- Design Pass & Mobile (IN PROGRESS)
**Status:** 🟡 Design pass mostly done, mobile PWA live, functional fixes deployed

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
| 10. Design Pass | 🟡 in progress | ⏳ running | Apple × X aesthetic, mobile PWA, iOS Mail replication next |

## Phase 10 -- What's Done

### Design Pass (Apple × X aesthetic)
- ✅ Sidebar: dark #0f1419, lucide icons, section dividers, hover states, collapsible
- ✅ TopBar: frosted glass blur, ⌘K search with focus animation
- ✅ Dashboard: stat cards with icons, hover lift, section accent bars, gradient progress bar
- ✅ Login page: dark background with radial gradient
- ✅ Email UI: rewrote all 4 component files to match design system
- ✅ CSS custom properties system (globals.css) with brand tokens

### Mobile / PWA
- ✅ PWA manifest + service worker + iOS meta tags (installable as app)
- ✅ Icons generated (192, 512, apple-touch-icon)
- ✅ Safe area insets for iPhone notch/Dynamic Island
- ✅ Responsive AdminLayout with mobile drawer sidebar (hamburger menu)
- ✅ Email page: single-panel on mobile (list OR detail, back button)
- ✅ Dashboard cards stack vertically on mobile

### Functional Fixes (this session)
- ✅ Quote generator: fixed docx template delimiter mismatch (`{{}}` not `{}`)
- ✅ Quote preview: "Edit Quote" button now goes back with form data preserved
- ✅ Quote preview: iframe links open in new tab (not hijack page)
- ✅ Email detail: body content constrained to viewport (no zoom/scroll overflow)
- ✅ Email detail: responsive header stacking on mobile
- ✅ Full email sync: 3,643 emails from Jan 2025 (nelson@ + hello@)
- ✅ Email auto-refresh: DB poll every 5s, IMAP sync every 30s
- ✅ Login password reset to: SignatureOS2024!

## Phase 10 -- What's Next (TODO)

### Priority 1: iOS Mail Replication
- [ ] Rebuild email module to feel exactly like iOS Mail app
- [ ] Slide transitions between list and detail view
- [ ] Swipe actions (archive, delete, flag)
- [ ] Blue unread dots
- [ ] Grouped by date (Today, Yesterday, This Week, etc.)
- [ ] Bottom reply/action bar (Reply, Reply All, Forward, Delete, Flag)
- [ ] Thread grouping (conversation view)
- [ ] Pull-to-refresh on mobile

### Priority 2: Remaining Design Polish
- [ ] Quotes page: apply Apple × X design to the form (currently raw embedded HTML)
- [ ] Pipeline/Kanban: design pass
- [ ] Contacts/Accounts/Leads/Deals list views: design pass
- [ ] Calendar: design pass
- [ ] Tasks: design pass

### Priority 3: Outstanding Items
- [ ] Nick's email (nick@signature-cleans.co.uk) -- needs IONOS password
- [ ] Codex audit on Phase 10 changes (currently running, check /tmp/codex-audit.txt)
- [ ] Any findings from codex audit need addressing

## Architecture

- **Stack:** Next.js 15 (App Router), Prisma 7, PostgreSQL, NextAuth v5
- **Domain:** os.signature-cleans.co.uk (SSL via Let's Encrypt)
- **Port:** 3200 (PM2 managed)
- **DB:** signature_cleans_os on localhost:5432
- **Design:** Apple × X -- dark sidebar, frosted glass topbar, light content area
- **Colours:** CSS custom properties in globals.css (--brand-blue: #2056A4, --brand-green: #6B8E23)

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
curl -H "Authorization: Bearer ***" https://os.signature-cleans.co.uk/api/dashboard
```

## Credentials

- Login: nelson@signature-cleans.co.uk / SignatureOS2024!
- Email accounts configured: nelson@, hello@ (IONOS passwords in DB user records)
- [ ] Nick's IONOS password still needed

## Key Files Modified This Session

- `src/app/layout.tsx` -- PWA meta tags, service worker registration, viewport config
- `src/app/globals.css` -- safe area insets for PWA
- `src/app/dashboard/emails/EmailDetail.tsx` -- mobile responsive, body overflow fix
- `src/app/dashboard/emails/page.tsx` -- mobile single-panel, back button
- `src/app/dashboard/quotes/page.tsx` -- edit quote flow, iframe sandbox fix, form data preservation
- `src/lib/quotes/pdf-generator.ts` -- delimiter fix ({{ }} not { })
- `src/components/Sidebar.tsx` -- mobile drawer
- `src/components/TopBar.tsx` -- hamburger menu
- `src/components/AdminLayout.tsx` -- mobile context provider
- `public/manifest.json` -- PWA manifest
- `public/sw.js` -- service worker
- `public/icon-192.png`, `icon-512.png`, `apple-touch-icon.png` -- app icons

## Security Hardening Applied

- All P1 findings fixed across all phases
- HTML escaping on all user inputs in email templates
- Rate limiting on login (10/15min), quotes (5/min), email send (10/min)
- Ownership checks on quote send, notification creation
- Prisma transactions on cadence start/pause/resume
- Input validation (types, lengths, ranges) on all POST/PATCH endpoints
- Error details never leaked to client
- Security headers via nginx
- DOMPurify sanitization on email body HTML rendering
- iframe sandbox with allow-popups only (no scripts, no same-origin)
