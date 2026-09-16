# Stock Opname & Async Reconciliation

## Tech stacks

| Layer | Stack |
|---|---|
| Frontend | React 18 (Create React App), Ant Design, React Router, TanStack React Query, Axios |
| Backend | Node.js, Express.js |
| Auth | JWT (`jose`), httpOnly cookie, RBAC |
| Database | PostgreSQL 16 (`pg`) |
| Password hash | bcryptjs |
| Async reconciliation | Separate Node worker that polls `reconciliation_jobs` |

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 16 running locally

## How to run

You need PostgreSQL, the API, the worker, and the frontend running together.

### 1. PostgreSQL

Create a database and user that match `stock-opname-be/.env.example`:

| Setting | Value |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| User | `stockopname` |
| Password | `stockopname` |
| Database | `stock_opname` |

Apply your schema and seed data, then keep PostgreSQL running.

### 2. Backend API

```bash
cd stock-opname-be
copy .env.example .env
npm install
npm run dev
```

- API: http://localhost:3001
- Health: http://localhost:3001/health

### 3. Reconciliation worker

```bash
cd stock-opname-be
npm run worker
```

Keep the API and worker running in two terminals.

### 4. Frontend

```bash
cd stock-opname-fe
copy .env.example .env
npm install
npm start
```

- Web: http://localhost:3000

## Environment variables

### Backend — `stock-opname-be/.env`

| Variable | Example |
|---|---|
| `PORT` | `3001` |
| `FRONTEND_ORIGIN` | `http://localhost:3000` |
| `DATABASE_URL` | `postgres://stockopname:stockopname@localhost:5432/stock_opname` |
| `JWT_SECRET` | change for production |
| `JWT_EXPIRES_HOURS` | `8` |
| `COOKIE_NAME` | `so_session` |

### Frontend — `stock-opname-fe/.env`

| Variable | Example |
|---|---|
| `REACT_APP_API_BASE_URL` | `http://localhost:3001` |
