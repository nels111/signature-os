# Signature Cleans OS — Product Specification

**Version:** 1.0.0
**Date:** 2026-05-09
**Authors:** Nelson Iseguan, Nick Stentiford
**Source of Truth:** Fireflies transcript `01KR3TB6P0PC2BEZ4Z8X29QMJW` (May 8, 2026)

---

## 1. Vision

Replace Zoho CRM and all standalone business tools with a single, custom-built operating system for Signature Cleans. One app. One login. Everything — CRM, email, tasks, calendar, quotes, pipeline, operations — in one place.

**"That's our software suite. That's the OS."** — Nick & Nelson, May 8 2026

### 1.1 Core Principles

1. **API-first, UI-second.** Every feature must have a REST API endpoint. Jaz (and future agents) operate the system via API. The UI is for Nelson, Nick, and future users.
2. **Fresh start.** No Zoho migration. No legacy data import. Clean database, clean codebase. Old data backed up to Dropbox.
3. **Multi-user from day one.** Nelson login, Nick login, future Paul (lead gen), future franchisees.
4. **Franchise-ready.** Every feature must work at scale. Documentation/tutorials for every section feed into School of Excellence.
5. **Replace the email app.** Nick wants to delete his email app entirely. All email (IONOS business + eventually personal iCloud) lives inside the OS.
6. **VPS-hosted.** Deployed on the existing IONOS VPS (87.106.255.163). Eventually a proper app store app for franchising.

### 1.2 Non-Negotiable Rules

- NEVER display hours, hourly rates, or hours-per-visit in any client-facing output
- Brand name is always "Signature Cleans" (never "Ltd")
- Quote floor: £25/hr. Target: £27/hr. Below £25 requires Head Office written approval
- Labour rate: £17/hr. Billing rate: £27/hr
- Weeks per month: 4.33 for all calculations
- Pilot pricing: 25% discount for 30 days

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | Next.js 15 (App Router) | Full-stack, SSR, API routes, proven |
| Database | PostgreSQL 15 | Relational, JSONB support, scalable |
| ORM | Prisma | Type-safe queries, migrations, schema-as-code |
| Auth | NextAuth.js v5 | Multi-user, JWT, extensible providers |
| Styling | Tailwind CSS 4 | Utility-first, consistent design system |
| Email | IMAP (imapflow) + SMTP (nodemailer) | Direct IONOS integration |
| Hosting | IONOS VPS (Ubuntu) | Existing infrastructure |
| Process Manager | PM2 | Production process management |
| Reverse Proxy | nginx + SSL (certbot) | Already configured |

### 2.1 Domain

- **Production:** `os.signature-cleans.co.uk`
- **Port:** 3200 (behind nginx reverse proxy)

---

## 3. Design System

### 3.1 Brand Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--color-dark` | `#1a1a1a` | Primary text, headers |
| `--color-brand-green` | `#2c5f2d` | Brand green, active states |
| `--color-accent-gold` | `#f9a825` | Accent, highlights, CTAs |
| `--color-bg` | `#ffffff` | Page background |
| `--color-surface` | `#f8f9fa` | Card backgrounds |
| `--color-border` | `#e2e8f0` | Borders, dividers |
| `--color-muted` | `#64748b` | Secondary text |

### 3.2 Typography

- **Font:** Inter (system fallback: -apple-system, sans-serif)
- **Headings:** Semi-bold, `--color-dark`
- **Body:** Regular, 14px base

### 3.3 Layout

- **Sidebar:** Collapsible, white background, brand green active state
- **TopBar:** Search, notifications bell (unread count badge), user menu
- **Content:** Max-width 1400px, responsive padding

---

## 4. Authentication & Users

### 4.1 Auth Model

- Email + password login (NextAuth Credentials provider)
- JWT strategy (stateless, no session table)
- Role-based access: `admin`, `sales`, `operations`, `viewer`

### 4.2 Initial Users

| User | Email | Role |
|------|-------|------|
| Nelson | nelson@signature-cleans.co.uk | admin |
| Nick | nick@signature-cleans.co.uk | sales |

### 4.3 Future Users

- Paul (lead gen contractor) — `sales` or `viewer` role
- Franchisees — scoped to their territory

### 4.4 Per-User Scoping

- **Email inboxes:** Each user sees ONLY their own inbox + shared `hello@` inbox
- **Personal calendar:** Private to each user, invisible to others
- **Shared calendar:** Visible to all, invite/accept/decline
- **Tasks:** Owned by user, visible per ownership + shared tasks
- **Pipeline:** Visible to sales + admin roles

---

## 5. Modules

### 5.1 Dashboard

**Route:** `/dashboard`

Role-based tabs:
- **Sales view:** Pipeline summary, lead count, deal values, conversion rate, recent leads
- **Operations view:** Weekly hours progress (1000hr target), active contracts, compliance, audit scores

Components:
- `GrowthProgressBar` — animated bar toward 1000 weekly hours target
- `StatCard` — key metric cards with trend indicators
- `RecentLeads` — last 5 leads with status
- `PipelineSnapshot` — deal stages with values

---

### 5.2 Task Manager

**Route:** `/tasks`
**Source:** Nick's Zoho CRM task layout (direct requirement)

#### Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| subject | string | ✅ | Task title |
| owner | relation(User) | ✅ | Assigned to |
| dueDate | datetime | ✅ | When it's due |
| priority | enum | ✅ | highest / high / normal / low / lowest |
| status | enum | ✅ | not_started / in_progress / completed / deferred / waiting |
| description | text | ❌ | Notes / detail (separate tab in UI) |
| taskType | enum | ✅ | business / personal / mobilisation / onboarding / audit_action / issue_followup |
| repeat | json | ❌ | Recurrence config: never / daily / weekly / biweekly / monthly / yearly / custom |
| reminder | json | ❌ | Array of reminder times (e.g. 1 hour before, 1 day before) |
| linkedLead | relation(Lead) | ❌ | Optional link to lead |
| linkedDeal | relation(Deal) | ❌ | Optional link to deal |
| linkedContact | relation(Contact) | ❌ | Optional link to contact |
| linkedContract | relation(Contract) | ❌ | Optional link to contract |

#### UI

- Two sections: **Business** and **Personal** (filtered by taskType)
- DataTable with inline status change (click to toggle)
- Create modal with all fields
- Search + filter by status, priority, owner, due date
- Overdue tasks highlighted in red
- **Nick's view reference:** Calendar shows meetings AND tasks below them — replicate this combined view

#### Notifications

- Reminder notifications at configured times
- Overdue notification if not completed by dueDate
- Repeating tasks auto-create next instance on completion

---

### 5.3 Calendar

**Route:** `/calendar`
**Source:** Nick's Apple Calendar workflow (direct requirement)

#### Three Layers

1. **Personal Diary** — Private to each user. "Nick's home diary Nelson doesn't see and Nelson's home diary Nick doesn't see because it's not important. But for me it's important. It's on the same portal."
2. **Shared Work Diary** — Visible to all users. Supports invites (send to another user → they accept/decline → appears in their diary)
3. **Task Integration** — Tasks with due dates render on the calendar alongside events

#### Event Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| title | string | ✅ | Event name |
| eventType | enum | ✅ | meeting / site_survey / follow_up / calendly / personal |
| calendarType | enum | ✅ | personal / shared |
| allDay | boolean | ✅ | Is it an all-day event? |
| startDate | datetime | ✅ | Start date + time |
| endDate | datetime | ✅ | End date + time |
| notes | text | ❌ | "Need to buy a present" — Nick's example |
| repeat | json | ❌ | never / daily / weekly / biweekly / monthly / yearly / custom |
| alerts | json | ❌ | Multiple alerts: "1 day before AND 1 hour before" |
| invitees | relation(User[]) | ❌ | Users invited to shared events |
| owner | relation(User) | ✅ | Who created it |
| linkedLead | relation | ❌ | Link to CRM entity |
| linkedDeal | relation | ❌ | Link to CRM entity |
| linkedContact | relation | ❌ | Link to CRM entity |

#### UI

- **Month view** and **Week view** toggle
- Click cell to create event
- Colour-coded by eventType
- Personal events in one colour, shared in another
- Tasks render below events (Nick's Zoho layout)
- Accept/decline shared invites

#### Notifications

- Multiple alert support ("remind me 1 day before AND 1 hour before")
- Repeating events: birthdays, anniversaries, recurring meetings

---

### 5.4 Email Client

**Route:** `/emails`
**Source:** Nick's #1 requirement — "I want to be able to get rid of the email app"

This is the largest and most complex module.

#### Architecture

- **IMAP polling** via `imapflow` — connects to IONOS IMAP (imap.ionos.co.uk:993)
- **SMTP sending** via `nodemailer` — IONOS SMTP (smtp.ionos.co.uk:587)
- **Per-user mailboxes:** Each user has their IONOS credentials configured
- **Shared mailbox:** `hello@signature-cleans.co.uk` visible to all

#### Initial Mailboxes

| Mailbox | User | IMAP/SMTP |
|---------|------|-----------|
| nick@signature-cleans.co.uk | Nick | IONOS |
| nelson@signature-cleans.co.uk | Nelson | IONOS |
| hello@signature-cleans.co.uk | Shared | IONOS |

#### Future: Personal Email

Nick wants to eventually add his iCloud personal email. Architecture must support adding arbitrary IMAP accounts per user.

#### Features

| Feature | Priority | Notes |
|---------|----------|-------|
| Live inbox view | P0 | Two-panel: email list (300px) + detail panel |
| Read/reply/compose in-app | P0 | Full email client functionality |
| Email trails linked to CRM | P0 | Link emails to leads, contacts, deals |
| Email templates | P1 | Reusable templates for common emails |
| Email signatures | P1 | Per-user signatures, auto-appended |
| Nurture sequences | P1 | Automated email sequences (see §5.7) |
| Scheduled sends | P1 | Send later functionality |
| Autoresponders | P2 | Auto-reply rules |
| Multiple mailbox tabs | P0 | Switch between inboxes |
| Auto-poll | P0 | 60-second polling interval |

#### CRM Linking

When viewing a Lead or Contact, show all associated emails in an "Email Trail" tab. Linking is by email address match.

#### Access Control (CRITICAL)

Each user sees ONLY their own inbox + `hello@`. Server-side enforcement by `ionosEmail` field on User model. No client-side filtering.

---

### 5.5 CRM Core — Contacts & Accounts

**Routes:** `/contacts`, `/accounts`

#### Contact Fields

| Field | Type | Required |
|-------|------|----------|
| firstName | string | ✅ |
| lastName | string | ✅ |
| email | string | ❌ |
| phone | string | ❌ |
| company | string | ❌ |
| accountId | relation(Account) | ❌ |
| notes | text | ❌ |
| source | enum | ❌ |
| createdBy | relation(User) | ✅ |

#### Account Fields

| Field | Type | Required |
|-------|------|----------|
| name | string | ✅ |
| industry | string | ❌ |
| website | string | ❌ |
| phone | string | ❌ |
| address | text | ❌ |
| notes | text | ❌ |

#### UI

- DataTable with pagination, search, sort, soft-delete
- Detail pages with linked entities (contacts under account, emails, deals)
- Create forms with validation

---

### 5.6 Pipeline — Leads & Deals

**Routes:** `/pipeline` (Kanban), `/leads`, `/deals`
**Source:** Nick's two-pipeline model (direct requirement)

#### Pipeline 1: Lead Pipeline

Stages (in order):
1. **Cold Call** — Initial outreach by phone
2. **Cold Email** — Initial email sent
3. **Follow-Up Sequence** — Automated/manual follow-ups (email 2, email 3, second call, direct mail)
4. **Meeting Scheduled** — Meeting booked
5. **Meeting Attended** — Meeting happened; sub-status: `good` / `bad` / `not_interested`
6. **Quote Delivered** — Quote sent → converts to Deal

#### Pipeline 2: Deal Pipeline

Stages (in order):
1. **Quote Sent** — Quote delivered to prospect
2. **Follow-Up From Quote** — Post-quote follow-up sequence
3. **Closed Won** — Deal won 🎉
4. **Closed Lost** — Deal lost (no sub-reasons needed — "we'll remember why")

#### Lead Fields

| Field | Type | Required |
|-------|------|----------|
| companyName | string | ✅ |
| contactName | string | ✅ |
| email | string | ❌ |
| phone | string | ❌ |
| source | enum | ✅ |
| stage | enum(LeadStage) | ✅ |
| meetingOutcome | enum | ❌ |
| owner | relation(User) | ✅ |
| notes | text | ❌ |
| linkedContact | relation | ❌ |
| linkedAccount | relation | ❌ |

#### Deal Fields

| Field | Type | Required |
|-------|------|----------|
| name | string | ✅ |
| stage | enum(DealStage) | ✅ |
| value | decimal | ❌ |
| weeklyHours | decimal | ❌ |
| contactId | relation(Contact) | ❌ |
| accountId | relation(Account) | ❌ |
| owner | relation(User) | ✅ |
| quoteId | relation(Quote) | ❌ |
| wonAt | datetime | ❌ |
| lostAt | datetime | ❌ |
| notes | text | ❌ |

#### UI

- **Kanban board** — drag-and-drop between stages (HTML5, no external lib)
- Lead pipeline and Deal pipeline on separate tabs
- Won/Lost summary cards below deal Kanban
- Meeting outcome dropdown when moving to "Meeting Attended"
- Auto-convert: moving lead to "Quote Delivered" creates a Deal in "Quote Sent"

#### Transition Rules

- Lead → "Quote Delivered" = auto-creates Deal at "Quote Sent" stage
- Deal → "Closed Lost" = optional loss reason modal
- Deal → "Closed Won" = triggers mobilisation flow (future phase)
- Timestamps recorded on every stage change

---

### 5.7 Email Cadence Engine

**Status:** Built as infrastructure, NOT activated by default (`ENABLE_CADENCE=false`)
**Note:** This is Nick's sales lane — Jaz configures the infrastructure, Nick controls activation

#### Cadence Model

- Sequences of timed emails attached to a Lead
- Merge fields: `{{contact_name}}`, `{{company_name}}`, `{{calendly_link}}`
- Pause triggers: reply received → PausedReplied, meeting booked → PausedMeeting, became active client → StoppedActiveClient
- After full sequence with no response → LongTermNurture (monthly loop)

#### API

- `POST /api/leads/[id]/start-cadence` — start sequence
- `POST /api/leads/[id]/pause-cadence` — pause sequence
- `GET /api/cadence/status` — overview of all active sequences

---

### 5.8 Quote Generator

**Route:** `/quotes`
**Status:** Already built as standalone — absorb into OS

#### Pricing Engine

| Parameter | Value |
|-----------|-------|
| Billing rate (target) | £27/hr |
| Billing rate (floor) | £25/hr |
| Labour cost | £17/hr |
| Weeks/month | 4.33 |
| Pilot discount | 25% for 30 days |
| Margin target | >25% |

#### Guardrails

- **BLOCK** if sell rate < £25 or margin < 25%
- **WARN** if sell rate < £27 (amber banner)
- Sell rate colour: green ≥ £27, amber ≥ £25, red < £25

#### Quote Flow

1. Create quote (linked to deal + account + contact)
2. Live pricing preview while editing (client-side calculator)
3. Send via email (branded HTML template with tracking pixel)
4. Track opens via `GET /api/track/open/[trackingId]`
5. Status lifecycle: Draft → Sent → Accepted / Rejected / Expired

#### Client-Facing Output

- **Standard template:** Navy pricing block, YouTube embed, Nick footer
- **Pilot template:** Yellow callout, strikethrough on regular price, savings badge
- **NEVER mentions hours or hourly rates** — monthly/weekly totals only

---

### 5.9 Fireflies Integration

**Source:** Nelson's direct requirement — "she just renames mine now"

#### Auto-Scan Flow

1. Poll Fireflies API (GraphQL) every 4 hours
2. Fetch new transcripts since last poll
3. Auto-rename based on transcript content analysis
4. Match to Lead/Contact/Deal by participant name or email
5. Attach transcript link + summary to the matched CRM entity

#### Display

- Fireflies tab on Lead/Contact/Deal detail pages
- Shows: title, date, summary, link to full transcript
- Auto-attached meetings appear with a 🎙️ icon

---

### 5.10 Notifications System

**Component:** Bell icon in TopBar with unread count

#### Notification Types

| Type | Trigger |
|------|---------|
| `task_due` | Task approaching due date |
| `task_overdue` | Task past due date |
| `event_reminder` | Calendar event alert (1 day, 1 hour, etc.) |
| `email_received` | New email in inbox |
| `deal_stage_changed` | Deal moved in pipeline |
| `lead_assigned` | Lead assigned to user |
| `invite_received` | Shared calendar invite |
| `cadence_reply` | Lead replied to cadence email |
| `audit_due` | Contract audit coming up |
| `shift_alert` | Clock-in / late / missed |

#### UI

- Notification bell with unread count badge
- Dropdown list with unread dots, timeAgo formatting
- Mark individual or mark all as read
- Click notification → navigate to relevant entity

---

### 5.11 Jaz API Layer

**Purpose:** Every module exposes REST API endpoints that Jaz can call programmatically

#### Standard API Pattern

```
GET    /api/{module}          — List (paginated, filterable, sortable)
POST   /api/{module}          — Create
GET    /api/{module}/[id]     — Read single
PUT    /api/{module}/[id]     — Update
DELETE /api/{module}/[id]     — Soft delete
```

#### Jaz-Specific Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/tasks` | Jaz creates tasks ("Hey Jaz, add to my task list") |
| `POST /api/calendar-events` | Jaz creates calendar entries |
| `POST /api/leads` | Jaz adds leads from voice input or Fireflies |
| `GET /api/dashboard` | Jaz pulls KPI data for morning briefings |
| `GET /api/deals?stage=*` | Jaz checks pipeline health |
| `POST /api/emails` | Jaz drafts emails (approval required before send) |
| `GET /api/notifications` | Jaz reads notifications to prioritise alerts |

#### Authentication for API

- API routes accept JWT bearer tokens
- Jaz authenticates once, uses token for all API calls
- Token refresh handled automatically

---

## 6. Future Modules (Not in V1)

These are acknowledged but deferred:

| Module | Notes |
|--------|-------|
| Voice Input ("Hey Jaz") | Siri replacement — add tasks, calendar, CRM queries while driving |
| Mobile App (Expo) | Proper app store app for franchising |
| Personal Email (iCloud) | Nick wants iCloud email in the OS eventually |
| Contract Management | Active contract tracking, mobilisation |
| Worker Management | Subcontractor profiles, compliance, QR clock-in |
| Scheduling | Shift management, attendance, templates |
| Audit System | Site audits with scoring |
| Document Generation | Site packs, proposals, SOPs |
| Reports | Financial, pipeline, conversion, attribution |
| Marketing Campaigns | Bulk email campaigns |

---

## 7. Database Schema

### 7.1 Models

```
User
  id              String    @id @default(cuid())
  name            String
  email           String    @unique
  password        String    (hashed)
  role            Role      (admin / sales / operations / viewer)
  ionosEmail      String?   (IMAP/SMTP email address)
  ionosPassword   String?   (encrypted IMAP/SMTP password)
  createdAt       DateTime
  updatedAt       DateTime

Account
  id              String    @id @default(cuid())
  name            String
  industry        String?
  website         String?
  phone           String?
  address         String?
  notes           String?
  createdBy       User
  createdAt       DateTime
  updatedAt       DateTime
  deletedAt       DateTime? (soft delete)

Contact
  id              String    @id @default(cuid())
  firstName       String
  lastName        String
  email           String?
  phone           String?
  company         String?
  accountId       String?   → Account
  notes           String?
  source          LeadSource?
  createdBy       User
  createdAt       DateTime
  updatedAt       DateTime
  deletedAt       DateTime?

Lead
  id              String    @id @default(cuid())
  companyName     String
  contactName     String
  email           String?
  phone           String?
  source          LeadSource
  stage           LeadStage
  meetingOutcome  MeetingOutcome?
  owner           User
  notes           String?
  contactId       String?   → Contact
  accountId       String?   → Account
  cadenceStatus   CadenceStatus?
  createdAt       DateTime
  updatedAt       DateTime
  stageChangedAt  DateTime
  deletedAt       DateTime?

Deal
  id              String    @id @default(cuid())
  name            String
  stage           DealStage
  value           Decimal?
  weeklyHours     Decimal?
  owner           User
  contactId       String?   → Contact
  accountId       String?   → Account
  quoteId         String?   → Quote
  convertedFromId String?   → Lead
  wonAt           DateTime?
  lostAt          DateTime?
  lossReason      String?
  notes           String?
  createdAt       DateTime
  updatedAt       DateTime
  stageChangedAt  DateTime
  deletedAt       DateTime?

Task
  id              String    @id @default(cuid())
  subject         String
  owner           User
  dueDate         DateTime
  priority        Priority
  status          TaskStatus
  taskType        TaskType
  description     String?
  repeat          Json?
  reminder        Json?
  linkedLeadId    String?   → Lead
  linkedDealId    String?   → Deal
  linkedContactId String?   → Contact
  createdAt       DateTime
  updatedAt       DateTime
  completedAt     DateTime?
  deletedAt       DateTime?

CalendarEvent
  id              String    @id @default(cuid())
  title           String
  eventType       EventType
  calendarType    CalendarType (personal / shared)
  allDay          Boolean
  startDate       DateTime
  endDate         DateTime
  notes           String?
  repeat          Json?
  alerts          Json?
  owner           User
  createdAt       DateTime
  updatedAt       DateTime
  deletedAt       DateTime?

CalendarInvite
  id              String    @id @default(cuid())
  eventId         String    → CalendarEvent
  inviteeId       String    → User
  status          InviteStatus (pending / accepted / declined)
  respondedAt     DateTime?

Email
  id              String    @id @default(cuid())
  messageId       String    @unique
  mailbox         String
  from            String
  to              String[]
  cc              String[]
  subject         String
  bodyText        String?
  bodyHtml        String?
  date            DateTime
  isRead          Boolean
  folder          String
  userId          String    → User
  linkedLeadId    String?   → Lead
  linkedDealId    String?   → Deal
  linkedContactId String?   → Contact
  trackingId      String?
  openCount       Int       @default(0)
  createdAt       DateTime

EmailTemplate
  id              String    @id @default(cuid())
  name            String
  subject         String
  bodyHtml        String
  mergeFields     String[]
  createdBy       User
  createdAt       DateTime
  updatedAt       DateTime

Quote
  id              String    @id @default(cuid())
  dealId          String?   → Deal
  accountId       String?   → Account
  contactId       String?   → Contact
  status          QuoteStatus (draft / sent / accepted / rejected / expired)
  weeklyHours     Decimal
  sellRate        Decimal
  labourRate      Decimal   @default(17)
  weeksPerMonth   Decimal   @default(4.33)
  isPilot         Boolean   @default(false)
  pilotDiscount   Decimal?  @default(25)
  monthlyTotal    Decimal
  annualTotal     Decimal
  margin          Decimal
  sentAt          DateTime?
  acceptedAt      DateTime?
  rejectedAt      DateTime?
  trackingId      String?
  openCount       Int       @default(0)
  createdBy       User
  createdAt       DateTime
  updatedAt       DateTime

Notification
  id              String    @id @default(cuid())
  userId          String    → User
  type            NotificationType
  title           String
  message         String
  read            Boolean   @default(false)
  entityType      String?
  entityId        String?
  createdAt       DateTime

FirefliesTranscript
  id              String    @id @default(cuid())
  firefliesId     String    @unique
  title           String
  date            DateTime
  summary         String?
  participants    String[]
  linkedLeadId    String?   → Lead
  linkedDealId    String?   → Deal
  linkedContactId String?   → Contact
  createdAt       DateTime

Activity
  id              String    @id @default(cuid())
  activityType    ActivityType
  description     String
  metadata        Json?
  userId          String    → User
  entityType      String?
  entityId        String?
  createdAt       DateTime

Cadence
  id              String    @id @default(cuid())
  leadId          String    → Lead
  status          CadenceStatus
  currentStep     Int       @default(0)
  startedAt       DateTime
  pausedAt        DateTime?
  pauseReason     String?
  nextSendAt      DateTime?
  createdAt       DateTime
  updatedAt       DateTime

CadenceStep
  id              String    @id @default(cuid())
  cadenceId       String    → Cadence
  stepNumber      Int
  templateId      String    → EmailTemplate
  delayDays       Int
  sentAt          DateTime?
  openedAt        DateTime?
  repliedAt       DateTime?
```

### 7.2 Enums

```
Role: admin, sales, operations, viewer
LeadSource: cold_call, cold_email, referral, website, mark_walker, direct_mail, other
LeadStage: cold_call, cold_email, follow_up_sequence, meeting_scheduled, meeting_attended, quote_delivered
MeetingOutcome: good, bad, not_interested
DealStage: quote_sent, follow_up_from_quote, closed_won, closed_lost
Priority: highest, high, normal, low, lowest
TaskStatus: not_started, in_progress, completed, deferred, waiting
TaskType: business, personal, mobilisation, onboarding, audit_action, issue_followup
EventType: meeting, site_survey, follow_up, calendly, personal
CalendarType: personal, shared
InviteStatus: pending, accepted, declined
QuoteStatus: draft, sent, accepted, rejected, expired
CadenceStatus: active, paused_replied, paused_meeting, stopped_active_client, completed, long_term_nurture
NotificationType: task_due, task_overdue, event_reminder, email_received, deal_stage_changed, lead_assigned, invite_received, cadence_reply, audit_due, shift_alert
ActivityType: note, call, email, meeting, status_change, task_completed, lead_created, deal_created, quote_sent, cadence_started
```

---

## 8. Build Phases

### Phase 1: Foundation (2-3 days)
- [ ] Next.js 15 project setup (App Router)
- [ ] PostgreSQL database + Prisma schema (all models)
- [ ] NextAuth v5 (email/password, JWT)
- [ ] Seed: Nelson (admin), Nick (sales)
- [ ] Design system: Tailwind tokens, layout components (Sidebar, TopBar)
- [ ] Dashboard shell with role-based tabs

### Phase 2: CRM Core (3-4 days)
- [ ] Contacts CRUD + API + UI (list, detail, create)
- [ ] Accounts CRUD + API + UI (list, detail, create)
- [ ] Entity linking (contacts under accounts)
- [ ] DataTable component (reusable: pagination, search, sort)
- [ ] Soft delete pattern

### Phase 3: Pipeline (3-4 days)
- [ ] Leads CRUD + API + UI
- [ ] Deals CRUD + API + UI
- [ ] Kanban board (HTML5 drag-and-drop)
- [ ] Two pipeline tabs (Lead / Deal)
- [ ] Stage transition rules + timestamps
- [ ] Lead → Deal auto-conversion

### Phase 4: Tasks & Calendar (4-5 days)
- [ ] Tasks CRUD + API + UI
- [ ] Business/Personal sections
- [ ] Reminders + repeat logic
- [ ] Calendar events CRUD + API + UI
- [ ] Month + Week views
- [ ] Personal vs Shared calendar layers
- [ ] Invite system (send/accept/decline)
- [ ] Tasks rendered on calendar

### Phase 5: Email Client (7-10 days)
- [ ] IMAP poller (imapflow, 60s interval)
- [ ] SMTP sender (nodemailer)
- [ ] Multi-mailbox support (nick@, nelson@, hello@)
- [ ] Two-panel inbox UI
- [ ] Compose, reply, forward
- [ ] Email ↔ CRM entity linking (by email address match)
- [ ] Email templates CRUD
- [ ] Signatures per user
- [ ] Scheduled sends
- [ ] Access control enforcement (server-side)

### Phase 6: Quote Generator (2-3 days)
- [ ] Quote model + pricing engine
- [ ] Create form with live pricing preview
- [ ] Guardrails (block/warn)
- [ ] Send via email (branded HTML templates)
- [ ] Open tracking (pixel + API)
- [ ] Quote list + detail pages

### Phase 7: Integrations (2-3 days)
- [ ] Fireflies polling + auto-attach
- [ ] Notification system (model + API + bell UI)
- [ ] Activity logging (all CRM actions tracked)

### Phase 8: Cadence Engine (2-3 days)
- [ ] Cadence model + step sequencing
- [ ] Pause/stop triggers
- [ ] Template merge fields
- [ ] `ENABLE_CADENCE=false` by default
- [ ] Cadence status dashboard

### Phase 9: Deployment & Polish (2-3 days)
- [ ] PM2 config
- [ ] nginx reverse proxy (os.signature-cleans.co.uk)
- [ ] SSL cert (certbot)
- [ ] Environment variables setup
- [ ] Mobile responsive pass
- [ ] Error handling + loading states
- [ ] Documentation / tutorials skeleton

**Total estimated build: 25-35 days**

---

## 9. Multi-Agent Build Strategy

Jaz orchestrates the build using Claude Code workers via git worktrees.

### Workflow

1. Jaz creates the SPEC.md and CLAUDE.md in the repo
2. For each phase, Jaz spins up Claude Code workers in isolated worktrees
3. Workers build modules in parallel where possible (e.g. Tasks + Calendar, Contacts + Accounts)
4. Jaz reviews output, runs tests, integrates to main
5. Workers cannot access each other's branches — merge conflicts handled by Jaz

### Parallelisation Map

| Parallel Group | Modules |
|---------------|---------|
| Group A | Contacts + Accounts |
| Group B | Leads + Deals + Kanban |
| Group C | Tasks + Calendar |
| Group D | Email Client (sequential — too complex to split) |
| Group E | Quote Generator + Fireflies |

### Commands

```bash
# Create worktree for a module
git worktree add -b phase2/contacts .claude/worktrees/contacts main

# Launch Claude Code worker
claude -p "Build the Contacts module per SPEC.md §5.5" \
  --allowedTools "Read,Write,Edit,Bash" \
  --max-turns 30 \
  --dangerously-skip-permissions

# After completion, merge
git checkout main
git merge phase2/contacts
```

---

## 10. Environment Variables

```env
# Database
DATABASE_URL=postgresql://sigcleans:xxx@localhost:5432/signature_cleans_os

# Auth
AUTH_SECRET=xxx
NEXTAUTH_URL=https://os.signature-cleans.co.uk

# IONOS Email (Nick)
IMAP_HOST_NICK=imap.ionos.co.uk
IMAP_PORT_NICK=993
IMAP_USER_NICK=nick@signature-cleans.co.uk
IMAP_PASS_NICK=xxx
SMTP_HOST_NICK=smtp.ionos.co.uk
SMTP_PORT_NICK=587
SMTP_USER_NICK=nick@signature-cleans.co.uk
SMTP_PASS_NICK=xxx

# IONOS Email (Nelson)
IMAP_HOST_NELSON=imap.ionos.co.uk
IMAP_PORT_NELSON=993
IMAP_USER_NELSON=nelson@signature-cleans.co.uk
IMAP_PASS_NELSON=xxx
SMTP_HOST_NELSON=smtp.ionos.co.uk
SMTP_PORT_NELSON=587
SMTP_USER_NELSON=nelson@signature-cleans.co.uk
SMTP_PASS_NELSON=xxx

# IONOS Email (Hello)
IMAP_HOST_HELLO=imap.ionos.co.uk
IMAP_PORT_HELLO=993
IMAP_USER_HELLO=hello@signature-cleans.co.uk
IMAP_PASS_HELLO=xxx

# Fireflies
FIREFLIES_API_KEY=xxx

# Feature Flags
ENABLE_IMAP=true
ENABLE_CADENCE=false

# App
PORT=3200
NODE_ENV=production
```

---

## 11. Acceptance Criteria

A phase is complete when:

1. ✅ All CRUD operations work via API (tested with curl)
2. ✅ UI renders correctly and matches design system
3. ✅ Pagination, search, and sort work on all list pages
4. ✅ Soft delete works (no hard deletes)
5. ✅ Entity linking works (clicking a linked entity navigates correctly)
6. ✅ No TypeScript errors (`npx tsc --noEmit`)
7. ✅ No ESLint errors (`npx eslint .`)
8. ✅ Responsive on mobile viewport
9. ✅ API returns proper error codes (400, 401, 404, 500)
10. ✅ Loading states shown during data fetches
