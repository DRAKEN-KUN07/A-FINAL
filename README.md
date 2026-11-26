# GatePass VMS — Visitor Pass Management System (MERN)

A full-stack **MERN (MongoDB, Express, React, Node.js)** Visitor Pass Management System enabling organizations to digitally pre-register guests, verify identities with OTP, issue HMAC-signed QR & printable PDF badges, log gate check-ins/check-outs, dispatch Email/SMS notifications, and export real-time analytics across multiple campuses and organizations.

---

## Key Features

### Core Assignment Features
1. **Authentication & Role-Based Access Control (JWT)**
   - Four distinct roles: **Admin**, **Security / Frontdesk**, **Employee / Host**, and **Visitor**.
   - JWT Bearer authentication, bcryptjs password hashing, and route/action RBAC guards.
2. **Visitor Registration (Details + Photo)**
   - Register visitors with full contact details, company, ID type/number, vehicle info, and photo upload (Multer disk upload or live **webcam snapshot capture**).
3. **Appointments & Pre-Registration**
   - Employees/Admins invite visitors (auto-approved with instant invite notifications).
   - Visitors self-register and pre-book visits for host approval (`pending` -> `approved` / `rejected`).
4. **Digital Pass Issuance (QR Code + Printable PDF Badge)**
   - Generates unique pass codes (`VP-YYYY-XXXXXX`), **HMAC-SHA256 signed QR tokens**, PNG QR codes (`qrcode`), and downloadable **PDF Visitor Badges** (`pdfkit`) embedding visitor photo, host details, validity window, and QR code.
   - Public pass verification route (`/verify/:passCode`).
5. **Security Gate Check-In / Check-Out (QR Scanner)**
   - Supports **Live Camera QR Scanning**, **QR Image Upload** (`jsQR`), **Manual Pass Code / QR Token Entry**, and **1-Click Active Queue Check-In/Out**.
   - Records every entry/exit in `CheckLogs` with gate, scan method, timestamp, and security officer.
6. **Notifications (Email & SMS)**
   - Real **Nodemailer (SMTP)** and **Twilio REST API** integration when credentials are provided.
   - Graceful fallback to persistent `NotificationLogs` in MongoDB so every invite, approval, OTP, pass issuance, and host arrival alert can be inspected in the **Notifications Center**.
7. **Dashboard & Reports (Search, Filter & Export)**
   - Real-time occupancy metrics, 7-day check-in/check-out bar chart, status & location breakdown, search/date filters, and **CSV / JSON export**.

### Bonus Challenges Implemented
- **OTP-Based Verification**: 6-digit hashed OTP generation/verification via Email/SMS (`OtpTokens`), with optional organization-level OTP enforcement at check-in.
- **Multi-Organization & Multi-Location Support**: Manage multiple organizations (`TechNova Global HQ`, `Apex BioLabs Campus`) and multiple gates/buildings per campus.
- **Security Audit Logs**: Immutable `AuditLogs` tracking logins, approvals, pass issuances, revocations, check-ins/outs, and org changes.
- **Docker + Nginx Deployment**: Production-ready `docker-compose.yml`, multi-stage `client/Dockerfile`, `server/Dockerfile`, and `nginx/nginx.conf` reverse proxy.

---

## MongoDB Collections

| Collection | Purpose |
| :--- | :--- |
| `Users` | Staff & visitor accounts (`admin`, `security`, `employee`, `visitor`) |
| `Visitors` | Guest profiles, ID metadata, photo paths, OTP & watchlist flags |
| `Appointments` | Invitations, pre-registrations, host assignments, approval state |
| `Passes` | Issued digital passes, pass codes, HMAC-signed QR tokens & QR DataURLs |
| `CheckLogs` | Gate check-in and check-out scan audit trail |
| `Organizations` | Multi-tenant organizations, campus gates/locations, OTP policies |
| `NotificationLogs` | Outbound Email & SMS audit history |
| `AuditLogs` | Compliance & security event trail |
| `OtpTokens` | Hashed 6-digit verification codes with TTL auto-expiry |

---

## Project Structure

```text
├── client/                 # React 18 + Vite frontend SPA
├── server/                 # Express + Mongoose REST API, PDFKit, QRCode, Vitest suite
├── nginx/nginx.conf        # Reverse proxy routing /api & /uploads -> server, / -> client
├── docker-compose.yml      # MongoDB + Server + Client + Nginx deployment stack
├── .env.example            # Environment configuration template
└── package.json            # Root scripts for dev, build, seed, and test
```

---

## Quick Start (Local Development)

### Prerequisites
- **Node.js** `>= 20` (tested on Node `24.18.0`) & **npm** `>= 10`
- **MongoDB** (optional if using embedded demo mode below)

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Configure Environment (Optional for Standard MongoDB)
```bash
cp .env.example .env
```
Edit `.env` with your `MONGO_URI` (and optional `SMTP_*` / `TWILIO_*` credentials).

### 3A. Run with Zero-Setup Embedded MongoDB + Auto-Seeded Demo Data
If you do not have a local `mongod` service running, start the full MERN app using `mongodb-memory-server`:
```bash
npm run dev:memory
```

### 3B. Run with Local / Atlas MongoDB
Seed demo data first:
```bash
npm run seed
```
Then launch backend and frontend in separate terminals:
```bash
npm run dev:server
npm run dev:client
```

- **Frontend UI**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000/api/health`

---

## Demo Accounts (Seeded Data)

All seeded accounts use password: **`Password123!`**

| Role | Email | Capabilities |
| :--- | :--- | :--- |
| **Admin** | `admin@gatepass.io` | Multi-org/gate setup, staff CRUD, analytics, reports, audit logs |
| **Security / Frontdesk** | `security@gatepass.io` | QR scanner gate check-in/out, pass issuance, walk-in registration |
| **Employee / Host** | `employee@gatepass.io` | Invite guests, approve/reject requests, view hosted passes |
| **Visitor** | `visitor@gatepass.io` | Pre-register visits, OTP verification, view QR & PDF passes |

---

## Deploy with Docker + Nginx

```bash
docker compose up --build -d
```
Nginx listens on **port `80`** (`http://localhost`), routing `/api/*` and `/uploads/*` to the Express container and serving the React production build with SPA fallback.

---

## Running Automated Tests

Integration tests run against a real in-memory MongoDB instance using **Vitest + Supertest**:
```bash
npm test
```

---

## Core API Endpoints

| Area | Endpoints |
| :--- | :--- |
| **Auth & OTP** | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/otp/request`, `POST /api/auth/otp/verify` |
| **Visitors** | `GET /api/visitors`, `POST /api/visitors` (multipart photo), `PUT /api/visitors/:id`, `PATCH /api/visitors/:id/blacklist` |
| **Appointments** | `GET /api/appointments`, `POST /api/appointments`, `PATCH /api/appointments/:id/approve`, `PATCH /api/appointments/:id/reject` |
| **Passes & PDF** | `GET /api/passes`, `POST /api/passes`, `GET /api/passes/:id/pdf`, `GET /api/passes/public/:passCode`, `PATCH /api/passes/:id/revoke` |
| **Gate Scanner** | `GET /api/checklogs`, `POST /api/checklogs/scan` |
| **Dashboard & Export** | `GET /api/dashboard/stats`, `GET /api/dashboard/reports`, `GET /api/dashboard/export?format=csv` |
| **Admin & Multi-Org** | `GET/POST /api/admin/users`, `GET/POST /api/admin/organizations`, `POST /api/admin/organizations/:id/locations`, `GET /api/admin/notifications`, `GET /api/admin/audit-logs` |
