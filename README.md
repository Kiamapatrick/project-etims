# eTIMS — Electronic Tax Invoice Management System


A two-sided platform for Kenyan tax compliance: accountant/auditor portal (document upload, CSV/XLSX import, manual entry, OCR/QR extraction, review dashboard, QuickBooks sync) + business POS app for direct invoice entry.

## Stack

- **Frontend:** Plain HTML/CSS/JS (served by Express static)
- **Backend:** Node.js + Express
- **Database:** MongoDB Atlas
- **Storage:** AWS S3 (Phase 2+)
- **Queue:** BullMQ + Redis (Phase 2+)
- **Auth:** JWT with bcrypt
- **Deployment:** Render (backend + frontend served together)

## Project Structure

```
project-etims/
├── backend/
│   ├── public/           # Static frontend assets
│   │   ├── index.html    # Main HTML page
│   │   ├── style.css     # Styles
│   │   └── script.js     # Vanilla JS logic
│   ├── src/
│   │   ├── config/       # Environment configuration
│   │   ├── db/           # MongoDB connection
│   │   ├── middleware/   # CORS, Helmet, Error handling, auth, access control
│   │   ├── models/       # Mongoose schemas (Business, User, Sale, DocumentUpload, AuditLog, etc.)
│   │   ├── routes/       # API routes (auth, firms, businesses, users, uploads, csv-import, reviews, pos, manual-entry, quickbooks)
│   │   ├── services/     # Business logic (extraction, csvImport, validator, confirmation, auditLog, s3, qrDecoder, ocr, imageProcessor, receiptConfig)
│   │   └── utils/        # Logger, diff utilities
│   └── package.json
├── .env.example
├── .gitignore
└── README.md
```

## Phases

| Phase | Description | Status |
|-------|-------------|--------|
| **Phase 0** | Foundation: repo structure, Express + MongoDB, health check, security basics | ✅ Complete |
| **Phase 1** | Data Layer & Auth: Mongoose schemas, JWT, RBAC, access control | ✅ Complete |
| **Phase 2** | Upload & Extraction: S3 uploads, BullMQ queue, QR/OCR pipeline | ✅ Complete |
| **Phase 3** | Review Dashboard: batch review, side-by-side editing, audit logs | ✅ Complete |
| **Phase 4** | QuickBooks Integration: OAuth, sync confirmed sales | 🔄 In Progress |
| **Phase 5** | POS App: dynamic forms, PWA, offline-first | ✅ Complete |
| **Phase 6** | Hardening: deploy, monitoring, data retention, DPA compliance | ⏳ |

## Quick Start

### Prerequisites

- Node.js 20+
- MongoDB Atlas account
- AWS account (for S3, Phase 2+)

### Backend Setup (serves frontend too)

```bash
cd backend
cp ../.env.example .env
# Edit .env with your values
npm install
npm run dev
```

Server runs at `http://localhost:4000`  
Frontend served at `http://localhost:4000`  
Health check: `GET http://localhost:4000/api/health`

### Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | 32+ char random string |
| `FRONTEND_ORIGIN` | Frontend URL (e.g., `http://localhost:4000`) |
| `PORT` | Backend port (default: 4000) |
| `AWS_*` | S3 credentials (Phase 2+) |
| `CSV_MAX_FILE_SIZE` | Max CSV/XLSX file size in bytes (default: 5MB) |
| `CSV_MAX_ROWS_PER_IMPORT` | Max rows per import (default: 2000) |
| `CSV_BASE_CONFIDENCE` | Base confidence for CSV imports (default: 0.9) |
| `REDIS_*` | Redis connection (Phase 2+) |
| `QB_*` | QuickBooks OAuth credentials (Phase 4) |

## Security

- Helmet.js for secure HTTP headers
- CORS locked to `FRONTEND_ORIGIN`
- JWT secrets in env only
- Passwords hashed with bcrypt
- Rate limiting on auth endpoints
- Signed S3 URLs with short expiry
- Input validation on all ingestion paths (OCR, CSV, manual, POS)
- Audit logging on all sale mutations (edit, confirm, reject, create)

## API Endpoints

### Health & Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check with DB status |
| `POST` | `/api/auth/login` | Login, returns JWT |
| `POST` | `/api/auth/refresh` | Refresh access token |
| `POST` | `/api/auth/logout` | Logout, clears cookie |

### Firms & Businesses (Accountant)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/firms` | List firms |
| `POST` | `/api/firms` | Create firm |
| `GET` | `/api/firms/:id` | Get firm details |
| `GET` | `/api/businesses` | List businesses (filtered by access) |
| `POST` | `/api/businesses` | Create business |
| `GET` | `/api/businesses/:id` | Get business details |
| `PATCH` | `/api/businesses/:id` | Update business |
| `POST` | `/api/businesses/:id/access` | Grant firm access to business |

### Document Upload & OCR/QR Extraction
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/uploads` | Upload images/PDFs (multipart) |
| `GET` | `/api/uploads/batch/:batchId/status` | Batch processing status |
| `GET` | `/api/uploads/batch/:batchId/file/:fileIndex` | File details |
| `POST` | `/api/uploads/batch/:batchId/file/:fileIndex/reprocess` | Reprocess single file |

### CSV / XLSX Import
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/csv-import` | Import CSV/XLSX file (multipart, `businessId` in body) |
| `GET` | `/api/csv-import/batch/:batchId/status` | Batch status (same shape as uploads) |

### Manual Entry (Accountant)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/sales/manual` | Create sale directly (validated, confirmed immediately) |

### Review Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/reviews` | List batches needing review |
| `GET` | `/api/reviews/:documentUploadId/file/:fileIndex` | File with extracted data |
| `POST` | `/api/reviews/:documentUploadId/file/:fileIndex/edit` | Edit extracted data |
| `POST` | `/api/reviews/:documentUploadId/file/:fileIndex/confirm` | Confirm as Sale |
| `POST` | `/api/reviews/:documentUploadId/file/:fileIndex/reject` | Reject with reason |
| `POST` | `/api/reviews/batch/:batchId/confirm` | Bulk confirm above threshold |
| `GET` | `/api/reviews/audit/:documentUploadId/file/:fileIndex` | Audit log for file |

### POS (Business Staff)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/pos/config` | Receipt config |
| `POST` | `/api/pos/sales` | Create POS sale |
| `GET` | `/api/pos/sales` | List POS sales (paginated, filterable) |

### QuickBooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/quickbooks/auth-url` | Start OAuth flow |
| `GET` | `/api/quickbooks/callback` | OAuth callback |
| `GET` | `/api/quickbooks/status` | Connection status |
| `POST` | `/api/quickbooks/sync` | Sync confirmed sales |

## Development

```bash
# Backend (from backend/)
npm run dev        # Start with file watching
npm run worker     # Start BullMQ worker (Phase 2+)
npm run lint       # Run ESLint
```

## Deployment (Render)

1. Connect GitHub repo
2. Build command: `cd backend && npm install`
3. Start command: `cd backend && npm start`
4. Add environment variables in Render dashboard
5. Frontend served automatically at `/` via `express.static`

## License

MIT