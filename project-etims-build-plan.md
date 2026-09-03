# Project eTIMS — Phased Build Plan

**Stack:** HTML/CSS/JS (frontend) · Node.js (backend) · MongoDB Atlas (database)
**Model:** Two-sided app — accountant/auditor side (Phase 1 entry point) + business POS side (Phase 5, later)
**Core principle:** All heavy processing (OCR, QR decode) runs server-side only — never in the browser.

---

## Phase 0 — Foundation & Setup

**Goal:** A running skeleton, deployable, with security basics wired in from day one.

**Build:**
- Repo structure: `/backend`, `/frontend`, `.env.example`, `.gitignore` (never commit `.env`, keys, or uploaded files)
- Node.js + Express server, connected to MongoDB Atlas
- Environment config via `dotenv` — DB connection string, JWT secret, encryption keys all in env vars
- Basic health-check endpoint (`GET /api/health`)
- CORS configured (allow only your frontend origin, not `*`)
- HTTPS enforced in production (handled by host, but code should redirect HTTP→HTTPS)

**Packages:** `express`, `mongoose`, `dotenv`, `cors`, `helmet` (sets secure HTTP headers by default)

**Security checklist:**
- [ ] `.env` never committed (verify `.gitignore` before first push)
- [ ] `helmet` middleware active
- [ ] CORS locked to known origins

**Definition of done:** Server runs locally, connects to Atlas, health-check responds, nothing sensitive in the repo.

---

## Phase 1 — Data Layer & Auth

**Goal:** All core collections exist with proper access control before any real feature is built on top.

**Build:**
- Mongoose schemas: `Business`, `AccountingFirm`, `FirmBusinessAccess`, `User`, `Sale`, `AuditLog`, `DocumentUpload`, `ReceiptConfig` (schema only — used in Phase 5), `QuickBooksConnection` (schema only — used in Phase 4)
- Indexes: `sales{business_id, sale_date}`, `firm_business_access{firm_id, business_id}`, `audit_logs{sale_id}`
- Auth: signup/login, JWT-based sessions, `password_hash` via `bcrypt` (never store plain passwords)
- Role-based middleware: `business_staff`, `accountant`, `admin` — every protected route checks role
- Access-control middleware: any request touching a `business_id` must verify it through `firm_business_access` for accountant-role users

**Packages:** `bcrypt`, `jsonwebtoken`

**Security checklist:**
- [ ] Passwords hashed, never logged or returned in API responses
- [ ] JWT secret is long, random, and in env vars only
- [ ] Every business-scoped route checks `firm_business_access` — no route trusts a raw `business_id` from the request body alone
- [ ] Rate-limit the login endpoint (`express-rate-limit`) to blunt brute-force attempts

**Definition of done:** Can register a firm + business, log in as each role, and confirm an accountant genuinely cannot access a business they're not linked to.

---

## Phase 2 — Upload & Extraction Pipeline

**Goal:** Bulk receipt upload that processes fast, accurately, and entirely server-side.

**Build:**
- Batch upload endpoint (multiple files per request), each file creates a `DocumentUpload` doc with `status: "pending"`, response returns immediately
- Files stored in object storage (S3 or Cloudflare R2) — private bucket, signed time-limited URLs, never public
- File-type/MIME validation on upload (reject anything that isn't image/PDF)
- Background job queue (`BullMQ` + Redis) — one job per file, processed in parallel by multiple workers
- Pipeline per job:
  1. QR/CUIN decode first (`jsQR` or similar) — ground-truth data if present
  2. OCR fallback (`node-tesseract-ocr` or `tesseract.js` run server-side) for files without a decodable QR
  3. Validation pass: line items sum to total, VAT math checks out, date is parseable and not in the future
  4. Confidence scoring → routes to `needs_review` or `extracted` (bulk-confirmable)
- Image downscale/optimize before OCR (`sharp`) for speed
- Status updates exposed via polling endpoint or WebSocket (`socket.io`)

**Packages:** `bullmq`, `ioredis`, `sharp`, `jsQR` (or `node-zxing`), `tesseract.js`, `multer` (upload handling), AWS SDK or R2-compatible client

**Security checklist:**
- [ ] Private bucket only, signed URLs with short expiry
- [ ] MIME/file-type validated before processing
- [ ] File size cap enforced, batch size cap enforced (e.g. 50–100 files/request)
- [ ] Workers run in isolated environment, no direct DB write access beyond their own job's `DocumentUpload`

**Definition of done:** Upload 20+ mixed images/PDFs at once, watch them process in parallel, see accurate status per file, confirm a no-QR receipt (like the M&S test case) correctly falls through to OCR.

---

## Phase 3 — Accountant Review Dashboard

**Goal:** The human-in-the-loop screen that turns extracted data into trusted `Sale` records.

**Build:**
- Batch view: grid/list of uploads in a batch, thumbnail + extraction status per item
- Review screen: original image side-by-side with extracted fields, editable
- "Confirm" action → creates the real `Sale` record, links back via `linked_sale_id`, logs to `AuditLog`
- Bulk "confirm all high-confidence" action for anything above the trust threshold
- Every edit or confirmation writes an immutable `AuditLog` entry (who, what changed, when)
- Filter/search by business, date range, status

**Security checklist:**
- [ ] `AuditLog` entries are append-only — no update/delete route exists for them at all
- [ ] Review screen only shows businesses the logged-in accountant has access to

**Definition of done:** An accountant can upload a batch, review it, confirm records, and see a clean audit trail of every action taken.

---

## Phase 4 — QuickBooks Integration

**Goal:** Confirmed sales sync out to QuickBooks without manual re-entry.

**Build:**
- OAuth 2.0 connect flow per business (`QuickBooksConnection` stores encrypted tokens)
- Sync confirmed `Sale` records → QuickBooks Online API (expenses/invoices)
- CSV export as a fallback/alternative to live sync
- Token refresh handling (QuickBooks refresh tokens expire — handle renewal automatically)

**Security checklist:**
- [ ] Access & refresh tokens encrypted at rest, never logged
- [ ] OAuth callback URL validated, state parameter used to prevent CSRF on the auth flow

**Definition of done:** A confirmed sale in your app appears correctly in a QuickBooks sandbox company.

---

## Phase 5 — POS App (Business Side)

**Goal:** Second entry point into the same `Sale` schema, replacing image/PDF capture for businesses that adopt it.

**Build:**
- `ReceiptConfig` editor (admin sets which fields a business type needs)
- POS form renders dynamically from that config
- Direct write into `Sale` collection — same shape as extracted receipts, so nothing downstream changes
- PWA setup (service worker, local caching) so it works through patchy connectivity and syncs once back online

**Definition of done:** A sale entered on the POS shows up in the accountant dashboard identically to one from the upload pipeline.

---

## Phase 6 — Hardening & Deployment

**Goal:** Ready for a real pilot business + real accounting firm.

**Build:**
- Deploy backend to Render/Railway/Fly.io, frontend to Netlify, DB on Atlas
- Environment separation: dev/staging/prod, separate credentials for each
- Monitoring/logging (basic error tracking — even a simple logger to start)
- Data retention policy for uploaded files (don't keep originals forever)
- Review against Kenya's Data Protection Act 2019 before onboarding a real business's data

**Definition of done:** Pilot-ready — one real business, one real accounting firm, running the full Phase 1–4 loop.

---

## Cross-cutting rules (apply in every phase)
1. All OCR/QR extraction is server-side only — the frontend never does heavy processing.
2. Every business-scoped query goes through `firm_business_access` — no shortcuts.
3. `AuditLog` is append-only, always.
4. Nothing gets auto-trusted into a `Sale` record without either a QR/CUIN match or human confirmation.
5. Secrets (JWT secret, DB URI, QuickBooks tokens, storage keys) live in env vars / secret manager — never in code, never in git history.
