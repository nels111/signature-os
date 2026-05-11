# iOS Mail UX Rebuild — Full Briefing

## What This Is
Signature Cleans OS email client needs to feel like the **iOS Mail app**. Currently it's a functional but generic email UI. We're rebuilding it to match native iOS Mail UX patterns exactly.

## Design System (MANDATORY)
- Read `/var/www/signature-cleans-os/AGENTS.md` for the full design system
- ALL colours use CSS custom properties from `globals.css` — never hardcode hex
- Design aesthetic: **Apple.com × X (Twitter)** — clean, minimal, premium
- Brand blue: `var(--brand-blue)` (#2056A4)
- Mobile-first, must work perfectly on iPhone

## Working Directory
`/var/www/signature-cleans-os`

## Files to Modify
All email UI files are in `src/app/dashboard/emails/`:

1. **page.tsx** (327 lines) — Main email page, orchestrates list/detail/compose
2. **EmailList.tsx** (183 lines) — Email list sidebar
3. **EmailDetail.tsx** (261 lines) — Email detail view with reply/forward
4. **ComposeModal.tsx** (232 lines) — Compose/reply modal

Layout files (already done, don't touch):
- `src/components/layout/AdminLayout.tsx` — Mobile drawer layout
- `src/components/layout/Sidebar.tsx` — Dark sidebar nav
- `src/components/layout/TopBar.tsx` — Frosted glass topbar

API files (don't touch, they work):
- `src/app/api/emails/route.ts` — GET list + POST send
- `src/app/api/emails/sync/route.ts` — IMAP sync trigger
- `src/app/api/emails/[id]/route.ts` — GET detail + PATCH update
- `src/app/api/emails/mailboxes/route.ts` — List mailboxes

## iOS Mail Features to Implement

### 1. Blue Unread Dots (like iOS Mail)
- Small blue circle (`var(--brand-blue)`) to the left of unread emails
- Replace the current "coloured avatar" unread indicator
- Dot disappears when email is read
- Exactly like iOS Mail's blue dot

### 2. Swipe Actions (iOS Mail style)
- **Swipe right**: Mark read/unread (blue flag icon)
- **Swipe left (short)**: Flag/star
- **Swipe left (long)**: Delete (red background with trash icon)
- Use touch events for mobile, keep click for desktop
- Smooth spring animations
- Reveal coloured action strip behind the row as you swipe

### 3. Thread/Conversation Grouping
- Group emails by subject line (strip Re:/Fwd: prefixes)
- Show thread count badge on grouped items
- Expand thread to see individual messages
- Most recent message preview shown in list
- Chevron indicator for threads with multiple messages

### 4. Slide Transitions (iOS-style navigation)
- List → Detail: slide left (detail slides in from right)
- Detail → List: slide right (back transition)
- Smooth 300ms ease-out transitions
- On mobile, full-screen takeover with back arrow

### 5. Bottom Action Bar (iOS Mail style)
- Move Reply/Forward/Delete to a bottom toolbar on mobile
- Icons only on mobile, icons + labels on desktop
- Archive, Reply, Forward, Delete, Mark Unread
- Sticky at bottom of detail view

### 6. Pull to Refresh (mobile)
- Pull down on email list to trigger IMAP sync
- Show spinner during refresh
- Snap back when done

### 7. Email Preview Text
- Show 1-2 lines of body text preview in the list (like iOS Mail)
- Grey text below the subject line
- Truncated with ellipsis

### 8. Sender Avatars
- Coloured circle with initial (already have this)
- Keep it, but make the colours consistent per sender (hash the email address)

### 9. Section Headers
- "Today", "Yesterday", "This Week", "Earlier" date section headers
- Sticky headers as you scroll (like iOS Mail)

## Architecture Notes
- The app is Next.js 15 with App Router
- Email data comes from Prisma/PostgreSQL (synced from IMAP)
- Frontend polls DB every 5 seconds for new mail
- Background IMAP sync every 30 seconds
- DOMPurify is already installed for HTML sanitisation
- `lucide-react` for icons

## Build Order
1. EmailList.tsx — Blue dots, preview text, date sections, swipe actions, sender colour hashing
2. page.tsx — Slide transitions between list/detail, pull-to-refresh
3. EmailDetail.tsx — Bottom action bar, iOS-style header
4. ComposeModal.tsx — Minor polish (this is already decent)

## PM2 & Building
```bash
cd /var/www/signature-cleans-os
npm run build
pm2 restart signature-os
```

## Rules
- NEVER mention hours in any client-facing content
- Use `var(--token)` CSS custom properties, never raw hex
- Mobile-first — test mobile layout first
- Run `npm run build` after changes to check for errors
- The app is live at os.signature-cleans.co.uk

## Current State
The email UI works — sends, receives, syncs, search, multi-mailbox. It just looks like a generic web email client. After this rebuild it should feel like opening Mail.app on an iPhone.
