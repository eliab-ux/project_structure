# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**EMDR Remoto** - A telemedicine platform for remote EMDR (Eye Movement Desensitization and Reprocessing) therapy sessions. The application connects psychologists (psicologos) with patients (pacientes) through video calls with real-time EMDR visual tools.

## Architecture

Monorepo with two main applications:

- **frontend/** - React 17 + TypeScript with TailwindCSS (Create React App + CRACO)
- **backend/** - Express + TypeScript with TypeORM and MySQL/MariaDB

### Key Integrations

- **Daily.co** - Video conferencing for therapy sessions
- **Socket.IO** - Real-time WebSocket for EMDR visual controls and chat
- **Twilio** - SMS notifications
- **Mailgun** - Email service

### Ports

| Service | Port |
|---------|------|
| Frontend | 3000 |
| WebSocket | 3001 |
| Backend API | 3002 |
| Database | 3306 |
| Adminer (local) | 8080 |

## Development Commands

### Local Database Setup

```powershell
# Start MariaDB + Adminer
docker compose up -d

# Start with dump restore (recommended)
.\restore.ps1

# Reset database (removes all data)
.\reset-db.ps1
```

Database credentials: `emdr/emdr` (user/password), database: `emdr`

### Frontend

```bash
cd frontend
yarn install
yarn start2     # Development (uses --openssl-legacy-provider)
yarn build      # Production build
yarn test       # Run tests
```

### Backend

```bash
cd backend
npm install
npm run dev     # Development with ts-node
npm run build   # Compile TypeScript
npm run start   # Build and run
```

## Backend Architecture

**Entry point**: [server.ts](backend/src/server.ts) initializes DB, Express, and WebSocket server

**Route registration**: Dynamic in [routes/routes.ts](backend/src/routes/routes.ts) - scans subdirectories and auto-registers route classes

**Key directories**:
- `controllers/` - Request handlers
- `models/` - TypeORM entities (Psicologo, Paciente, Sessions)
- `repository/` - Database access layer
- `services/` - External service integrations (daily.co, twilio, mailer)
- `websocket/` - Socket.IO event handlers for real-time EMDR controls

**Database**: TypeORM with config in [ormconfig.js](backend/ormconfig.js). Uses environment variables for connection.

**API prefix**: All routes use `/emdr-api/` prefix

## Frontend Architecture

**Entry point**: [index.tsx](frontend/src/index.tsx) -> [routes.js](frontend/src/routes.js)

**Routing**: React Router with `react-router-guards` for authenticated routes (psicologo-only areas)

**Key directories**:
- `pages/` - Route components (emdr/, home/, loginPsicologo/, etc.)
- `components/` - Shared UI (videoChamada/, timer/, chat/, modals/)
- `services/` - API client wrappers
- `middleware/` - Route guards (PsicologoMiddleware)

**Authentication**: JWT tokens stored in cookies, validated via middleware

## Deployment

Production uses Docker Compose per service with Nginx reverse proxy:

```bash
cd /opt/projects/frontend  # or backend
git pull
docker compose up -d --build
```

Nginx config routes:
- `/socket.io/` -> WebSocket (3001)
- `/emdr-api/` -> Backend (3002)
- `/` -> Frontend (3000)

## Key Flows

1. **Session Creation**: Psicologo creates session -> Daily.co room created -> Patient receives link via SMS/email
2. **EMDR Session**: WebSocket syncs visual stimulus controls between psicologo and paciente
3. **Cron Job**: Auto-cleanup of expired Daily.co rooms (runs every minute in [app.ts](backend/src/app.ts))
