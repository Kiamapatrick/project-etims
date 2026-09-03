# eTIMS — Electronic Tax Invoice Management System

A two-sided platform for Kenyan tax compliance: accountant/auditor portal (document upload, OCR/QR extraction, review dashboard, QuickBooks sync) + business POS app for direct invoice entry.

## Stack

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Database:** MongoDB Atlas
- **Storage:** AWS S3 (Phase 2+)
- **Queue:** BullMQ + Redis (Phase 2+)
- **Auth:** JWT with bcrypt
- **Deployment:** Render (backend), Netlify (frontend)

## Project Structure

```
project-etims/
├── backend/
│   ├── src/
│   │   ├── config/       # Environment configuration
│   │   ├── db/           # MongoDB connection
│   │   ├── middleware/   # CORS, Helmet, Error handling
│   │   ├── routes/       # API routes
│   │   └── utils/        # Logger
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx       # Main app component
│   │   ├── main.jsx      # Entry point
│   │   └── styles.css    # Global styles
│   ├── index.html
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

### Backend Setup

```bash
cd backend
cp ../.env.example .env
# Edit .env with your values
npm install
npm run dev
```

Server runs at `http://localhost:4000`  
Health check: `GET http://localhost:4000/api/health`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173` (proxies `/api` to backend)

### Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `JWT_SECRET` | 32+ char random string |
| `FRONTEND_ORIGIN` | Frontend URL (e.g., `http://localhost:5173`) |
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

# Frontend (from frontend/)
npm run dev        # Start Vite dev server
npm run build      # Production build
npm run preview    # Preview production build
```

## Deployment

### Backend (Render)

1. Connect GitHub repo
2. Build command: `cd backend && npm install`
3. Start command: `cd backend && npm start`
4. Add environment variables in Render dashboard

### Frontend (Netlify)

1. Connect GitHub repo
2. Base directory: `frontend`
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Add environment variables

## License

MIT