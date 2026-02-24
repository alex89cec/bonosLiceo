# Rifas Liceo — Architecture Document

## 1. Assumptions

1. **Payment is external**: The system tracks payment status but does not integrate a payment gateway in MVP. Admin or seller manually confirms payment (via dashboard or future webhook).
2. **Ticket becomes "sold"** when all installments are marked paid, OR the single full payment is confirmed. Until then it stays "reserved" (subject to TTL expiry for initial reservation, but once first payment is confirmed the reservation is "locked" and no longer expires).
3. **One ticket per buyer per campaign** (MVP default, configurable via `max_tickets_per_buyer`).
4. **Buyer email is the unique identifier** — no buyer auth required. Email is normalized (lowercased, trimmed).
5. **Numbers are pre-allocated**: Admin imports/assigns specific 6-digit numbers to sellers. Only those numbers exist as ticket rows.
6. **Campaign slug and seller code are public**. Seller code is a cryptographically random 8-char alphanumeric token (not sequential).
7. **Rate limiting** is enforced at the Edge (Vercel middleware / Supabase Edge Function) — not inside Postgres.
8. **Timezone**: All timestamps in UTC. Display conversion on client.
9. **PWA**: Service worker + manifest for installability. Offline mode is read-only (cached campaign info).
10. **Stack**: Next.js 14+ (App Router), TypeScript, Tailwind CSS, Supabase JS SDK v2, Supabase CLI for migrations.

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    Client (PWA)                      │
│  Next.js App Router — Mobile-first Tailwind UI       │
│                                                       │
│  Public Pages        Seller Dashboard   Admin Panel   │
│  /c/[slug]/s/[code]  /seller/*          /admin/*      │
└──────────┬───────────────┬──────────────┬────────────┘
           │               │              │
           ▼               ▼              ▼
┌─────────────────────────────────────────────────────┐
│              Next.js API Routes / Middleware          │
│  • Rate limiting (IP + email window)                 │
│  • CSRF protection                                    │
│  • Input validation (zod)                             │
└──────────┬───────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────┐
│                 Supabase Platform                     │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │   Auth   │  │ Realtime │  │   Edge Functions  │  │
│  │ (Admin/  │  │ (ticket  │  │   (optional:      │  │
│  │  Seller) │  │  updates)│  │    cron cleanup)  │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
│                                                       │
│  ┌──────────────────────────────────────────────────┐│
│  │              PostgreSQL Database                  ││
│  │  • RLS on ALL tables                              ││
│  │  • RPC: reserve_ticket() — atomic w/ FOR UPDATE   ││
│  │  • RPC: cleanup_expired_reservations()            ││
│  │  • RPC: confirm_payment()                         ││
│  │  • Audit log triggers                             ││
│  └──────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

## 3. ERD (Text)

```
profiles (1) ──── (M) campaign_sellers (M) ──── (1) campaigns
                                                      │
                                                      │ 1
                                                      ▼
                                                   tickets (M)
                                                   │      │
                                              1    │      │ 1
                                              ▼    │      ▼
                                           buyers  │  reservations
                                              │    │      │
                                              │    │      │ 1
                                              ▼    │      ▼
                                                   │  payments
                                                   │      │
                                                   │      │ 1
                                                   │      ▼
                                                   │  installments
                                                   │
                                              audit_log (standalone)
```

### Table Relationships:
- **profiles** ↔ **campaign_sellers**: A seller profile can be assigned to many campaigns
- **campaigns** ↔ **tickets**: A campaign has many ticket numbers
- **tickets** → **profiles** (seller): Each ticket is allocated to one seller
- **tickets** → **reservations**: A ticket can have one active reservation
- **buyers** ↔ **reservations**: A buyer can have reservations
- **reservations** → **payments**: Each reservation has one payment record
- **payments** → **installments**: A payment can have many installment records

## 4. Ticket State Machine

```
                 ┌─────────────────┐
    Admin        │                 │
    allocates    │  assigned_to_   │◄──── cleanup_expired()
    ──────────►  │    seller       │◄──── admin_release()
                 │                 │
                 └────────┬────────┘
                          │
                 reserve_ticket() RPC
                          │
                          ▼
                 ┌─────────────────┐
                 │                 │     expires_at reached
                 │    reserved     │─────────────────────────►  back to assigned_to_seller
                 │                 │
                 └────────┬────────┘
                          │
                 confirm_payment() RPC
                 (all installments paid
                  OR full payment confirmed)
                          │
                          ▼
                 ┌─────────────────┐
                 │                 │
                 │      sold       │  (terminal state)
                 │                 │
                 └─────────────────┘
```
