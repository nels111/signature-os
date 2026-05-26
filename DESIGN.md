# SigOS — Design System

## Color strategy: Restrained

Single accent, tinted neutrals. Color for state and identity only — not decoration.

## Palette

```
Background:    #F8F8F6  (warm off-white — not generic grey)
Surface:       #FFFFFF
Surface hover: #F5F5F3

Text primary:  #1A1A1F
Text secondary:#60606A
Text muted:    #9C9CA8

Border:        #DADADA
Border strong: #BABAC0

Brand blue:    #2056A4  (primary actions, links, focus rings)
Brand green:   #7DB227  (ops indicators, growth)

Status success:#16A34A
Status warning:#D97706
Status danger: #DC2626
Status info:   #2563EB
```

## Sidebar (dark)

```
Background:    #0F1419  (X/Twitter dark)
Text:          #E7E9EA
Text muted:    #71767B
Hover:         rgba(231, 233, 234, 0.08)
Active:        rgba(231, 233, 234, 0.12)
```

## Typography

- Font: `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Inter', system-ui, sans-serif`
- Feature settings: `'cv02', 'cv03', 'cv04', 'cv11'`
- Body: 14px / 1.5 line height
- Labels: 11–12px, font-weight 500–600, letter-spacing 0.04–0.08em
- Data values: 24–32px, font-weight 700, letter-spacing -0.03em
- Scale: 1.125–1.2 between steps

## Radius

```
sm: 8px    (buttons, badges, small inputs)
md: 12px   (dropdowns, small cards)
lg: 16px   (cards, modals)
xl: 20px   (hero cards)
```

## Shadows

```
card:  0 0 0 1px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.07)
hover: 0 0 0 1px rgba(0,0,0,0.06), 0 6px 24px rgba(0,0,0,0.12)
modal: 0 0 0 1px rgba(0,0,0,0.08), 0 32px 96px rgba(0,0,0,0.22)
```

## Motion

- Easing: `cubic-bezier(0.23, 1, 0.32, 1)` (strong ease-out, Emil standard)
- UI interactions: 150–200ms
- Page animations: 250–350ms
- Stagger: 30–80ms between sequential items
- Gate all hover motion: `@media (hover: hover) and (pointer: fine)`
- Always include: `@media (prefers-reduced-motion: reduce)`

## Component vocabulary

**Cards**: `border: 1px solid var(--border)`, `border-radius: var(--radius-xl)`, `box-shadow: var(--shadow-card)`, white background. No side stripes.

**Icons in cards**: 32–40px square, `border-radius: var(--radius-sm)`, low-opacity accent background (8–10%), accent-colored icon.

**Stat values**: 28–32px, font-weight 700, letter-spacing -0.03em.

**Labels**: 11px, font-weight 600, uppercase, letter-spacing 0.06em, text-muted color.

**Hover on clickable cards**: `translateY(-1px)` + shadow upgrade. 150ms ease-out.

**Badges/pills**: `border-radius: 9999px`, 10–11px font, font-weight 500–600.

## Banned patterns (absolute)

- Side-stripe borders: `border-left` or `border-right` > 1px as accent. Replace with icon tint + full border.
- Gradient text: `background-clip: text`. Use solid color.
- Glassmorphism as decoration.
- Hero-metric template (big number + gradient accent).
- Identical icon-heading-text card grids.
