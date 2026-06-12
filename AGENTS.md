<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Signature Cleans OS — Design System

## Brand Palette (v2 — May 2026)
All colours MUST use CSS custom properties from `src/app/globals.css`. Never hardcode hex values.

| Token | Value | Usage |
|-------|-------|-------|
| `--brand-blue` | `#2056A4` | Primary accent, buttons, active nav, links |
| `--brand-green` | `#6B8E23` | Success states, positive metrics |
| `--brand-green-bg` | `#A8C256` | Logo inner circle |
| `--brand-gold` | `#D4900A` | Warning states, pipeline highlights |
| `--text-primary` | `#1d1d1f` | Headings, body text |
| `--text-secondary` | `#6e6e73` | Secondary text |
| `--text-muted` | `#a1a1a6` | Labels, captions |
| `--surface` | `#ffffff` | Cards, panels |
| `--background` | `#f5f5f7` | Page background |
| `--border` | `#e8e8ed` | Dividers, card borders |
| `--status-danger` | `#D1242F` | Error states, overdue |

## Rules
- Use `var(--token)` in inline styles, never raw hex values
- Cards: `rounded-xl`, `border: 1px solid var(--border)`, `boxShadow: var(--shadow-card)`
- Focus rings: use `focus-brand` CSS class or `focus:ring-[var(--brand-blue)]/30`
- Logo: `/public/logo-badge.svg` (circular badge, blue ring + green inner)

# SigOS — Codex Agent Context

## What This Is
Signature Cleans OS (SigOS) is the internal operational platform for Signature Cleans, a commercial cleaning company. It handles cold calling, quoting, shift management, contract oversight, and operative tracking.

**Live URL**: https://os.signature-cleans.co.uk
**Stack**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Prisma ORM, PostgreSQL
**Owner**: hermes user on the server
**Process manager**: PM2 under hermes user

## Commands

### Read logs
```bash
sudo -u hermes pm2 logs signature-os --lines 50
```

### Build
```bash
cd /var/www/signature-cleans-os && sudo -u hermes npm run build
```

### Restart
```bash
sudo -u hermes pm2 restart signature-os
```

### Database queries (read-only)
```bash
sudo -u hermes psql -d signature_os -c "SELECT ..."
```

### Check process
```bash
sudo -u hermes pm2 status signature-os
```

## Key File Locations

| Area | Path |
|------|------|
| API routes | src/app/api/ |
| Dashboard pages | src/app/dashboard/ |
| Business logic | src/lib/ |
| Auth config | src/lib/auth.ts |
| DB client (Prisma) | src/lib/prisma.ts |
| DB schema | prisma/schema.prisma |
| Global styles / CSS vars | src/app/globals.css |
| Cold calling logic | src/lib/cold-calling/ |
| Cold calling components | src/app/dashboard/cold-calling/components/ |
| Twilio token endpoint | src/app/api/twilio/token/route.ts |
| Twilio voice webhook | src/app/api/webhooks/twilio/voice/route.ts |

## Auth / Roles
- Roles: admin, va (virtual assistant / caller), user
- Auth: NextAuth.js with JWT strategy — name/role baked into token at login. DB changes only take effect after next login.
- VA login: hello@signature-cleans.co.uk

## Database Schema (key tables)
- users — app users (id, name, email, password, role)
- leads — cold calling leads (stage, isCallable, nextCallAt, firstCalledAt, queueType, etc.)
- cold_call_attempts — individual call records (leadId, userId, status, outcome, callSid, durationSeconds)
- activities — activity log per lead
- cold_call_tasks — follow-up tasks from call outcomes
- quotes — quote records
- contracts — contract records

## Lead Stages (cold calling)
new_lead → cold_call → follow_up_sequence → contact_when_contract_up → not_interested_for_now → not_interested → dormant

## Queue Buckets
- Fresh: stage in (new_lead, cold_call), firstCalledAt IS NULL
- Follow-ups: stage in (follow_up_sequence, contact_when_contract_up)
- Callbacks: has a pending cold_call_task of type callback
- Recycle: stage in (cold_call, not_interested_for_now), nextCallAt <= now, firstCalledAt IS NOT NULL

## Audit Rules
- Never run UPDATE/DELETE without being instructed explicitly
- Never restart the process mid-audit without confirming the build succeeds first
- Read before writing: always read the current file before making edits
- Files owned by hermes — use sudo -u hermes for any write operations
- After any code change, run the build and confirm it passes before restarting

## Common Failure Patterns
- Permission denied on .next/ → sudo chown -R hermes:hermes /var/www/signature-cleans-os/.next
- EADDRINUSE on restart → another process owns the port, check: ss -tlnp | grep 3200
- JWT shows stale name/role → user needs to log out and back in
