# Rifas Liceo

Mobile-first web application for creating, managing, and selling raffle tickets by campaigns.

## Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + RLS + RPC)
- **Deployment**: Vercel + Supabase Cloud

## Local Setup

### Prerequisites

- Node.js 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started)
- Docker (for local Supabase)

### 1. Clone and install

```bash
git clone <repo-url> rifas-liceo
cd rifas-liceo
npm install
```

### 2. Set up environment

```bash
cp .env.example .env
```

### 3. Start Supabase locally

```bash
npx supabase start
```

This applies all migrations from `supabase/migrations/` automatically.
Copy the `anon key` and `API URL` from the output into your `.env`.

### 4. Seed demo data

```bash
npx supabase db reset
```

This runs migrations + `supabase/seed.sql`.

Demo credentials:
- **Admin**: admin@rifasliceo.com / admin123456
- **Seller**: seller1@rifasliceo.com / seller123456

### 5. Start dev server

```bash
npm run dev
```

Open http://localhost:3000

### 6. Generate TypeScript types

```bash
npm run supabase:gen-types
```

## Migrations

| File | Purpose |
|------|---------|
| `20240101000001_init.sql` | Tables, constraints, indexes, audit triggers |
| `20240101000002_rls.sql` | RLS enablement + all policies |
| `20240101000003_rpc.sql` | `reserve_ticket()`, `cleanup_expired_reservations()`, `confirm_payment()`, `get_available_tickets()`, `lookup_reservation()` |

### Apply to production

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

## Key URLs

| Route | Description |
|-------|-------------|
| `/c/{slug}/s/{code}` | Public buyer reservation page |
| `/login` | Admin/Seller login |
| `/admin` | Admin dashboard |
| `/seller/dashboard` | Seller dashboard |
| `/api/reservations` | POST — reservation API |
