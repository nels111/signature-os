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
