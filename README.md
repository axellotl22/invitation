# Invitation App

Create event invitations, share one link, and collect RSVPs **per household** — protected by a 6-digit **PIN**. Hosts manage a guest list, ask **additional questions** (e.g. meal choice), resolve **duplicate households**, and export responses as CSV. The entire app is available in **English and German**.

## Features

- **Host dashboard** — create invitations with title, description, location, date, RSVP deadline and a cover image.
- **Households & PINs** — each household on the guest list gets a unique 6-digit PIN (rate-limited against guessing). One RSVP per household; resubmitting updates it.
- **Guest flow** — open the share link, enter the PIN, mark each household member as attending or not, answer the host's questions, leave a message.
- **Additional questions** — free text, yes/no, single or multiple choice; asked per household or per attending member; defined in both languages.
- **Duplicate resolver** — fuzzy name matching, identical emails or identical member sets flag candidate pairs; merge (the loser's PIN redirects to the winner), keep both, or delete.
- **i18n** — full English/German UI with a language toggle; the invitation page opens in the language the host chose; a build-time check enforces translation-key parity.
- **CSV export** of all responses including question answers.

## Stack

- **Backend:** Node.js, Fastify, TypeScript, Prisma (SQLite), JWT cookie auth, sharp for image processing.
- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, react-router, react-i18next.
- **Reverse proxy:** nginx in front of both services — the SPA and the API share one origin, so the browser never makes a cross-origin request and CORS is a non-issue.

## Run with Docker

```bash
cp .env.example .env          # set JWT_SECRET to a long random string
docker compose up --build
```

Open http://localhost:8080. All traffic enters through the `proxy` container, which routes `/api` and `/uploads` to the backend and everything else to the static frontend. The SQLite database and uploaded images live in named volumes (`db-data`, `uploads`).

```
browser ──:8080──▶ proxy (nginx) ──▶ /api, /uploads ──▶ backend (Fastify :3001)
                                └──▶ /*             ──▶ frontend (nginx, static SPA)
```

## Local development

Backend (port 3001):

```bash
cd backend
npm install
echo 'DATABASE_URL="file:./dev.db"' > .env
npx prisma migrate dev
npm run dev
```

Frontend (port 5173 — Vite's dev server proxies `/api` and `/uploads` to the backend, so development is also CORS-free):

```bash
cd frontend
npm install
npm run dev
```

Tests / checks:

```bash
cd backend && npm test            # API end-to-end smoke test
cd frontend && npm run check-i18n # translation completeness
cd frontend && npm run build      # i18n check + type check + bundle
```

## How the PIN flow works

1. The host adds households (single or bulk); the server generates a PIN unique within the invitation.
2. A guest opens `/i/<slug>`, enters the PIN (max 5 attempts / 10 min per IP) and receives a short-lived token scoped to their household.
3. The RSVP is stored per member; submitting again overwrites the previous answer. Closed invitations and passed deadlines are enforced server-side.

## Environment variables (backend)

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | — | SQLite connection string, e.g. `file:/data/app.db` |
| `JWT_SECRET` | `dev-secret-change-me` | Signs session and household tokens — set a real value in production |
| `UPLOAD_DIR` | `./uploads` | Where processed images are stored |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed origin for the dev frontend |
| `COOKIE_SECURE` | `false` | Set `true` behind HTTPS |
| `PORT` | `3001` | API port |
