# Security Model, Threat Model & Test Plan

## 1. Permission Matrix

| Resource | Admin | Seller | Public (anon) |
|---|---|---|---|
| **profiles** | CRUD all | Read/Update own | No access |
| **campaigns** | CRUD all | Read assigned only | Read active only |
| **campaign_sellers** | CRUD all | Read own assignments | No access |
| **tickets** | CRUD all | Read own tickets | Read available only (`assigned_to_seller`) |
| **buyers** | CRUD all | Read buyers of own tickets | No direct access (created via RPC) |
| **reservations** | CRUD all | Read own ticket reservations | No direct access (created via RPC) |
| **payments** | CRUD all | Read own reservation payments | No direct access |
| **installments** | CRUD all | Read own payment installments | No direct access |
| **audit_log** | Read only | No access | No access |

### RPC Permissions

| Function | Admin | Seller | Public |
|---|---|---|---|
| `reserve_ticket()` | Yes | Yes | Yes |
| `get_available_tickets()` | Yes | Yes | Yes |
| `lookup_reservation()` | Yes | Yes | Yes |
| `cleanup_expired_reservations()` | Yes | Yes | No |
| `confirm_payment()` | Yes | No | No |

## 2. Threat Model

### 2.1 Scraping / Enumeration

**Threat**: Attacker enumerates all available ticket numbers across sellers.

**Mitigations**:
- RLS restricts ticket visibility: anon users can only see `assigned_to_seller` status tickets
- `get_available_tickets()` requires valid campaign_slug + seller_code pair
- Seller codes are random 8-char hex (4 bytes = 4 billion combinations)
- Rate limiting on API calls (5 req/min per IP)
- Response pagination (max 100 tickets per page in UI)

### 2.2 Brute Force Reservation

**Threat**: Attacker rapidly reserves tickets to deny availability.

**Mitigations**:
- Rate limiting: 5 reservations per minute per IP
- Rate limiting: 5 reservations per minute per email
- `max_tickets_per_buyer` enforcement (default: 1 per campaign)
- Reservation TTL auto-expires unreserved tickets (default: 15 min)
- `cleanup_expired_reservations()` runs on schedule and lazily

### 2.3 Concurrency / Double Booking

**Threat**: Two users simultaneously reserve the same ticket.

**Mitigations**:
- `SELECT ... FOR UPDATE` row lock in `reserve_ticket()` RPC
- PostgreSQL EXCLUDE constraint on reservations (only one active/confirmed per ticket)
- Entire reservation flow is a single atomic transaction
- Status check happens AFTER acquiring the row lock

### 2.4 Seller Data Leakage

**Threat**: Seller A sees Seller B's tickets/reservations/buyers.

**Mitigations**:
- RLS policies enforce `seller_id = auth.uid()` on all seller queries
- `campaign_sellers` table restricts which campaigns a seller can access
- Buyer data is only visible to sellers who have reservations on their tickets

### 2.5 Buyer Email Exposure

**Threat**: Buyer email addresses are scraped or leaked.

**Mitigations**:
- No anonymous direct access to `buyers` table (RLS blocks it)
- Buyer creation happens inside `reserve_ticket()` (SECURITY DEFINER)
- `lookup_reservation()` requires both reservation_id AND email (prevents enumeration)
- Seller can see only emails of buyers who reserved their tickets

### 2.6 Replay Attacks with Seller Links

**Threat**: Attacker reuses a seller link after campaign ends.

**Mitigations**:
- `reserve_ticket()` validates `campaign.status = 'active'` AND `now() BETWEEN start_date AND end_date`
- Closed campaigns reject all reservations at the database level
- Expired seller codes (is_active = false) are rejected

### 2.7 Input Injection

**Threat**: SQL injection, XSS via ticket numbers or emails.

**Mitigations**:
- All inputs validated with Zod schemas before reaching the database
- Ticket numbers: `^[0-9]{6}$` regex constraint in DB + app
- Emails: normalized (lowercase, trimmed) + validated
- Parameterized queries via Supabase client (no raw SQL in app layer)
- CSP headers configured in next.config.js

### 2.8 Privilege Escalation

**Threat**: Seller modifies their profile to become admin.

**Mitigations**:
- `profiles.role` cannot be changed via RLS (seller can only update non-role fields)
- `is_admin()` / `is_seller()` are SECURITY DEFINER functions
- Admin-only RPCs (`confirm_payment`) check role inside the function

## 3. Security Checklist

- [x] RLS enabled on ALL tables (9/9)
- [x] Every table has explicit policies for each role
- [x] No table allows unrestricted public read
- [x] `reserve_ticket()` is SECURITY DEFINER with input validation
- [x] Row-level locking (FOR UPDATE) prevents double booking
- [x] EXCLUDE constraint as secondary defense against double booking
- [x] Rate limiting on reservation endpoint (IP + email)
- [x] Input validation (Zod) on all API routes
- [x] Security headers (X-Frame-Options, X-Content-Type-Options, CSP)
- [x] Seller codes are cryptographically random
- [x] Audit logging on critical tables (tickets, reservations, payments, installments)
- [x] Service role key only used server-side (never exposed to client)
- [x] Auth middleware protects /admin and /seller routes
- [x] Email normalization prevents duplicate buyer entries

## 4. RLS Test Strategy

### Unit Tests (SQL-level)

```sql
-- Test 1: Anon cannot read reserved tickets
SET role TO anon;
SELECT * FROM tickets WHERE status = 'reserved';
-- Expected: 0 rows

-- Test 2: Seller cannot read other seller's tickets
SET request.jwt.claim.sub TO 'seller-b-uuid';
SELECT * FROM tickets WHERE seller_id = 'seller-a-uuid';
-- Expected: 0 rows

-- Test 3: Anon cannot read buyers table
SET role TO anon;
SELECT * FROM buyers;
-- Expected: 0 rows

-- Test 4: Seller cannot read audit_log
SET request.jwt.claim.sub TO 'seller-uuid';
SELECT * FROM audit_log;
-- Expected: 0 rows

-- Test 5: Admin can read everything
SET request.jwt.claim.sub TO 'admin-uuid';
SELECT count(*) FROM tickets; SELECT count(*) FROM buyers;
SELECT count(*) FROM audit_log;
-- Expected: non-zero rows
```

### Integration Tests

```
Test: Concurrent reservation of same ticket
  1. Start two parallel reserve_ticket() calls for ticket #000001
  2. Assert: exactly one succeeds, one fails with "not available"
  3. Assert: ticket status is 'reserved' (not double-booked)

Test: Reservation expiration
  1. Reserve a ticket with 1-minute TTL
  2. Wait 61 seconds (or mock time)
  3. Call cleanup_expired_reservations()
  4. Assert: ticket status is 'assigned_to_seller'
  5. Assert: reservation status is 'expired'

Test: Max tickets per buyer
  1. Set max_tickets_per_buyer = 1
  2. Reserve ticket #000001 for buyer@test.com
  3. Attempt to reserve ticket #000002 for buyer@test.com
  4. Assert: second reservation fails

Test: Cross-seller isolation
  1. Attempt to reserve Seller A's ticket via Seller B's link
  2. Assert: fails with "Ticket not found for this seller"

Test: Rate limiting
  1. Send 6 reservation requests in 1 minute from same IP
  2. Assert: 6th request returns 429

Test: Payment confirmation flow
  1. Reserve ticket → confirm_payment(full) → verify ticket.status = 'sold'
  2. Reserve ticket → confirm_payment(installment 1/3)
     → verify ticket.status = 'reserved', payment.status = 'partial'
  3. Confirm installments 2/3 and 3/3
     → verify ticket.status = 'sold', payment.status = 'completed'

Test: Campaign lifecycle
  1. Create campaign (draft) → attempt reservation → fails
  2. Activate campaign → attempt reservation → succeeds
  3. Close campaign → attempt reservation → fails
```

## 5. Concurrency Test Script

```bash
#!/bin/bash
# concurrent_reservation_test.sh
# Requires: curl, jq

URL="http://localhost:3000/api/reservations"
BODY='{
  "campaign_slug": "rifa-navidena-2024",
  "seller_code": "sel1abc0",
  "buyer_email": "test@example.com",
  "ticket_number": "000001",
  "payment_mode": "full_payment"
}'

# Fire 5 concurrent requests
for i in $(seq 1 5); do
  curl -s -X POST "$URL" \
    -H "Content-Type: application/json" \
    -d "$BODY" &
done

wait

# Expected: exactly 1 returns 201, rest return 409 or 429
```

## 6. Audit Logging Plan

### What is logged:
- All INSERT/UPDATE/DELETE on: tickets, reservations, payments, installments
- Logged fields: table_name, record_id, action, old_data, new_data, performed_by, created_at

### Retention:
- Keep audit logs for at least 1 year (campaign lifecycle + legal)
- Archive to cold storage after 90 days (future enhancement)

### Access:
- Only admin can read audit_log (RLS policy)
- No user can UPDATE or DELETE audit_log entries
- Audit trigger runs as SECURITY DEFINER (cannot be bypassed by RLS)
