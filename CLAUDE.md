# Signature Cleans OS

## MANDATORY: BEFORE ANY UI/FRONTEND WORK

HARD GATE. Before writing a single component, page, or style change:

1. Read `/home/dorabot/.claude/skills/impeccable/skill/SKILL.md` — anti-slop rules, 23 commands
2. Read `/home/dorabot/.claude/skills/ui-ux-pro-max-skill/.claude/skills/ui-ux-pro-max/SKILL.md` — design intelligence
3. Read `/home/dorabot/.claude/skills/taste-skill/skills/` — aesthetic judgment
4. Check `/home/dorabot/.claude/skills/awesome-design-md/design-md/` for reference design specs

If you skip this, you are violating build protocol. No exceptions.

## SPEC
All build instructions are in SPEC.md — ALWAYS re-read relevant sections before building any module.

## Tech Stack
- Next.js 15 (App Router), TypeScript strict
- PostgreSQL + Prisma ORM
- NextAuth v5 (email/password, JWT)
- Tailwind CSS 4
- Port 3200

## Code Standards
- TypeScript strict mode, no `any`
- 2-space indentation
- Single quotes for strings
- All API routes return proper status codes (400, 401, 404, 500)
- All list endpoints support pagination, search, sort
- Soft delete pattern (deletedAt field) — never hard delete
- Server components by default, 'use client' only when needed
- All forms validate on submit
- Loading states for all async operations

## Brand Tokens (Tailwind)
- Dark: #1a1a1a
- Brand Green: #2c5f2d
- Accent Gold: #f9a825
- Background: #ffffff
- Surface: #f8f9fa
- Border: #e2e8f0
- Muted: #64748b

## NEVER
- Never mention hours or hourly rates in client-facing output
- Never hard delete records
- Never use `any` type
- Never skip error handling on API routes
