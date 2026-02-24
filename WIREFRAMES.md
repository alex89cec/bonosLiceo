# Mobile UI Wireframes & UX Notes

## Public Buyer Flow: `/c/{slug}/s/{code}`

### Screen 1: Email Registration
```
┌─────────────────────────────┐
│                             │
│      ◆ Rifas Liceo          │
│      Reserva tu numero      │
│                             │
│  ┌─────────────────────────┐│
│  │                         ││
│  │  Correo electronico *   ││
│  │  ┌───────────────────┐  ││
│  │  │ tu@email.com      │  ││
│  │  └───────────────────┘  ││
│  │                         ││
│  │  Nombre (opcional)      ││
│  │  ┌───────────────────┐  ││
│  │  │                   │  ││
│  │  └───────────────────┘  ││
│  │                         ││
│  │  Telefono (opcional)    ││
│  │  ┌───────────────────┐  ││
│  │  │ +1 234 567 8900   │  ││
│  │  └───────────────────┘  ││
│  │                         ││
│  │  ┌───────────────────┐  ││
│  │  │    Continuar      │  ││
│  │  └───────────────────┘  ││
│  └─────────────────────────┘│
└─────────────────────────────┘
```

**UX Notes:**
- Email field uses `inputMode="email"` for mobile keyboard
- Phone uses `inputMode="tel"`
- Minimum 44px touch targets on all inputs/buttons
- Email validation inline (disable button until valid)
- Auto-capitalize off on email field

### Screen 2: Number Selection
```
┌─────────────────────────────┐
│ ← Atras                    │
│ Elige tu numero             │
│ 20 numeros disponibles      │
│                             │
│ ┌───────────────────────┐   │
│ │ 🔍 Buscar numero...   │   │
│ └───────────────────────┘   │
│                             │
│ ┌────────┬────────┬────────┐│
│ │ 000001 │ 000002 │ 000003 ││
│ ├────────┼────────┼────────┤│
│ │ 000004 │ 000005 │ 000010 ││
│ ├────────┼────────┼────────┤│
│ │ 000020 │▓000050▓│ 000100 ││  ← selected (filled bg)
│ ├────────┼────────┼────────┤│
│ │ 000200 │ 000500 │ 001000 ││
│ ├────────┼────────┼────────┤│
│ │ 005000 │ 010000 │ 050000 ││
│ └────────┴────────┴────────┘│
│                             │
│ ┌───────────────────────────┐│
│ │    Reservar #000050       ││  ← sticky bottom
│ └───────────────────────────┘│
└─────────────────────────────┘
```

**UX Notes:**
- Grid: 3 columns on phone, 4 on larger phones (sm breakpoint)
- Number buttons: 48px min height, monospace font, bold
- Selected state: primary-600 bg, white text, scale animation
- Search: numeric keyboard (`inputMode="numeric"`), filters as you type
- Show max 100 at a time with "Mostrando 100 de N. Usa el buscador."
- Virtualized list recommended for large allocations (>500 numbers)
- Sticky "Reservar" button at bottom, disabled until selection
- Loading state: spinner centered, skeleton grid optional

### Screen 3: Confirmation
```
┌─────────────────────────────┐
│ ← Cambiar numero            │
│ Confirmar reserva            │
│                             │
│ ┌─────────────────────────┐ │
│ │ Numero       #000050    │ │
│ │ Email    tu@email.com   │ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ Modo de pago             │ │
│ │                          │ │
│ │ ◉ Pago completo         │ │
│ │ ○ Cuotas                │ │
│ └─────────────────────────┘ │
│                             │
│ ┌───────────────────────────┐│
│ │    Confirmar reserva      ││
│ └───────────────────────────┘│
└─────────────────────────────┘
```

**UX Notes:**
- Radio buttons with large touch areas (full-row tap)
- Payment mode uses `has-[:checked]` CSS for visual feedback
- Error banner appears above confirm button (red bg)
- Button shows spinner + "Reservando..." during request
- Disabled during submission to prevent double-clicks

### Screen 4: Success
```
┌─────────────────────────────┐
│                             │
│            ✓                │
│                             │
│    Reserva confirmada        │
│                             │
│        #000050              │
│   Rifa Navidena 2024        │
│                             │
│   Expira: 24/02/26 15:30   │
│                             │
│ ┌─────────────────────────┐ │
│ │ ⚠ Completa tu pago      │ │
│ │ antes de que expire      │ │
│ │ la reserva.              │ │
│ │                          │ │
│ │ Se envio info a          │ │
│ │ tu@email.com             │ │
│ └─────────────────────────┘ │
│                             │
│ ID: abc123-def456           │
└─────────────────────────────┘
```

**UX Notes:**
- Checkmark icon (text, no emoji dependency)
- Countdown timer (optional enhancement: live JS countdown)
- Yellow warning box with payment instructions
- Reservation ID in small gray text at bottom
- No navigation back (flow is complete)

---

## Seller Dashboard: `/seller/dashboard`

```
┌─────────────────────────────┐
│ Panel del Vendedor           │
│ Maria Garcia                 │
│                             │
│ ┌───────┬────────┬────────┐ │
│ │  15   │   3    │   2    │ │
│ │Dispon.│Reserv. │Vendidos│ │
│ └───────┴────────┴────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ Tu enlace QR             │ │
│ │ /c/rifa.../s/sel1abc0   │ │
│ └─────────────────────────┘ │
│                             │
│ Reservas recientes           │
│                             │
│ ┌──────────┬──────────────┐ │
│ │ #000050  │    active    │ │
│ │ a@b.com  │              │ │
│ ├──────────┼──────────────┤ │
│ │ #000001  │  confirmed   │ │
│ │ c@d.com  │              │ │
│ └──────────┴──────────────┘ │
└─────────────────────────────┘
```

**UX Notes:**
- Stats cards: 3-column grid, large numbers, color-coded
- QR link: copyable, with "Copy" button (future: generate QR image)
- Reservation list: minimal PII (only email), status badge
- Search by ticket number (future enhancement)
- Pull-to-refresh pattern (future)

---

## Admin Dashboard: `/admin`

```
┌─────────────────────────────┐
│ Admin Panel                  │
│ Campanas | Vendedores | Rep. │
│                             │
│ ┌───────────────────┐[+ New]│
│                             │
│ ┌─────────────────────────┐ │
│ │ Rifa Navidena 2024      │ │
│ │ /rifa-navidena-2024     │ │
│ │ $50 | TTL:15min | 3cuot │ │
│ │                 [active]│ │
│ └─────────────────────────┘ │
│                             │
│ ┌─────────────────────────┐ │
│ │ Rifa Primavera          │ │
│ │ /rifa-primavera         │ │
│ │ $25 | TTL:30min         │ │
│ │                 [draft] │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

**UX Notes:**
- Tab navigation: Campaigns, Sellers, Reports
- Campaign cards: name, slug, price, status badge
- Status colors: green=active, yellow=draft, gray=closed
- Admin screens optimized for tablet too (max-w-5xl)
- Bulk operations (number allocation via CSV) on campaign detail page
- Reports: CSV export button for ticket/payment data

---

## Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| min-touch | 44px | All interactive elements |
| border-radius | 12px (xl) | Cards, buttons, inputs |
| font-mono | system mono | Ticket numbers |
| primary-600 | #2563eb | Buttons, selected states |
| spacing | 16px (p-4) | Page padding mobile |

## Loading States

- **Skeleton**: Not used in MVP; simple centered spinner
- **Spinner**: 32px border animation, primary-600 color
- **Button loading**: Inline spinner + "Reservando..." text
- **Error**: Red card with message + retry button

## Accessibility

- All inputs have associated `<label>` elements
- Color contrast: WCAG AA minimum (4.5:1)
- Focus-visible outlines on all interactive elements
- Screen reader: semantic HTML (h1, nav, main, form)
- No color-only information (status has text + color)
