# eTIMS — Electronic Tax Invoice Management System

A two-sided platform for Kenyan tax compliance: accountant/auditor portal (document upload, OCR/QR extraction, review dashboard, QuickBooks sync) + business POS app for direct invoice entry.

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
│   │   ├── middleware/   # CORS, Helmet, Error handling
│   │   ├── routes/       # API routes
│   │   └── utils/        # Logger
│   └── package.json
├── .env.example
├── .gitignore
└── README.md
```

## Phases

| Phase | Description | Status |
|-------|-------------|--------|
| **Phase 0** | Foundation: repo structure, Express + MongoDB, health check, security basics | ✅ Complete |
| **Phase 1** | Data Layer & Auth: Mongoose schemas, JWT, RBAC, access control | 🔄 Next |
| **Phase 2** | Upload & Extraction: S3 uploads, BullMQ queue, QR/OCR pipeline | ⏳ |
| **Phase 3** | Review Dashboard: batch review, side-by-side editing, audit logs | ⏳ |
| **Phase 4** | QuickBooks Integration: OAuth, sync confirmed sales | ⏳ |
| **Phase 5** | POS App: dynamic forms, PWA, offline-first | ⏳ |
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

## Security

- Helmet.js for secure HTTP headers
- CORS locked to `FRONTEND_ORIGIN`
- JWT secrets in env only
- Passwords hashed with bcrypt (Phase 1)
- Rate limiting on auth endpoints (Phase 1)
- Signed S3 URLs with short expiry (Phase 2)

## API Endpoints (Phase 0)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check with DB status |

## Development

```bash
# Backend (from backend/)
npm run dev        # Start with file watching
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