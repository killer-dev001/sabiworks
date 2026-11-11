# Sabi — finishing the build: setup & verification

## 1. Apply the database migrations (required before the app works)

Run these in order against your Supabase / Lovable Cloud database (SQL editor or `psql`):

1. `drizzle/migrations/0000_sabi_phase1_schema.sql` — already applied if your project is live.
2. `drizzle/migrations/0001_sabi_phase2_enums.sql` — new project states. **Run on its own** (Postgres needs
   new enum values committed before they're used).
3. `drizzle/migrations/0002_sabi_phase2_core.sql` — contracts, messages, deliverables, reviews, notifications,
   payments, reports, portfolio, activity log, admin roles, locked-down write permissions, workflow functions,
   storage buckets and storage policies.

After applying, regenerate `src/integrations/supabase/types.ts` with Lovable/Supabase if you want it re-synced
(a matching version is already included).

## 2. Create your first admin

Sign up normally, then run (replace the email):

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@example.com';
```

An **Admin** item then appears in the sidebar (reports, workspaces, projects, payment records).
Admin power is enforced in the database, not by hiding the link.

## 3. Configure

- Auth: in Supabase → Authentication, make sure your site URL and `/reset-password` are allowed redirect URLs.
- Storage buckets `workspace-media` (public, images, 5 MB) and `deliverables` (private, 50 MB) are created by
  migration 0002. Confirm they exist.
- Deploy to Vercel/Lovable with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (already in `.env`).
  Never put a service-role key in client code.

## 4. Verify

```sh
npm run test                      # 37 front-end tests (validation, every route resolves)
npx tsc --noEmit && npm run lint  # types + lint
npm run build
# Database security + full journey (needs a scratch Postgres with Supabase's auth/storage schemas;
# drizzle/tests/support/supabase_stub.sql emulates them for local runs):
psql "$SCRATCH_DB_URL" -v ON_ERROR_STOP=1 -f drizzle/tests/marketplace_flow.test.sql
```

The database test script runs 99 checks in one rolled-back transaction: row-level security, protected columns,
every status transition, hiring, messaging isolation, deliverables, reviews, payments, notifications, reports,
admin actions, rate limits and storage rules.

## How the security model works

- Clients can only write allowed columns (column-level grants). `status`, `rating`, `verified`, `is_demo`,
  `suspended`, payments, contracts and reviews cannot be written directly.
- Every state change goes through a database function that checks who is calling and whether the transition
  is legal: `set_proposal_status`, `hire_creative`, `set_project_status`, `send_message`, `submit_deliverable`,
  `request_revision`, `approve_project`, `submit_review`, `report_payment`, `confirm_payment`, admin functions.
- Proposals are visible only to the creative who sent them and the project's owner. Messages, deliverables,
  contracts and payments are visible only to the two parties (and admins).
- Rate limits (in the database): proposals 15/hour, projects 10/hour, messages 20/minute, reports 10/day.

## Payments

Payments are a provider-independent ledger with a clearly labelled **manual** mode: the brand records a transfer
reference, the creative confirms receipt, and both see the status. Sabi does **not** hold funds and the UI never
claims escrow or protection. No card data is collected or stored. When EmbassyCard (or any provider) confirms in
writing what it supports (API, webhooks, settlement, refunds, marketplace/split payments), add a server-side
module that calls `payments` status changes from verified webhooks only.

## Known limits / next steps

- Demo content (`is_demo`) stays visible but can't be hired, messaged or edited; creatives can still send test
  proposals to demo projects.
- Email notifications are not included (in-app notifications only).
- Messages refresh every few seconds (polling), not real-time sockets.
- Run an end-to-end browser pass (two accounts: brand + creative) against your live Supabase before launch.
