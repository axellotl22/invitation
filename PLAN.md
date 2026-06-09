# Invitation App — Development Plan

An app where a host can create invitations for events, share them with guests, and collect RSVPs.

## 1. Core Concept

- **Host** creates an event invitation (title, description, date/time, location, optional image).
- The app generates a **shareable link** (unique token) for each invitation.
- **Guests** open the link — no account required — see the event details, and RSVP (Yes / No / Maybe, plus-ones, optional message).
- The host sees a **dashboard** with all their invitations and a live list of responses per event.

## 2. Recommended Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router, TypeScript) | One codebase for UI + API routes, easy deployment |
| Database | SQLite via Prisma ORM (Postgres-ready schema) | Zero-setup local dev; swap to Postgres for production by changing the connection string |
| Styling | Tailwind CSS + shadcn/ui | Fast, clean UI without design overhead |
| Auth (host only) | Auth.js (NextAuth) with email magic links or Google OAuth | Guests never need to log in |
| Validation | Zod | Shared validation between forms and API |
| Email (optional, later) | Resend | Invitation sending + RSVP notifications |

Alternative: if you'd prefer a lighter stack, a plain Express + SQLite + server-rendered templates app works too — but Next.js keeps everything in one project and deploys to Vercel for free.

## 3. Data Model

```prisma
model User {            // the host
  id          String       @id @default(cuid())
  email       String       @unique
  name        String?
  invitations Invitation[]
}

model Invitation {
  id          String   @id @default(cuid())
  slug        String   @unique          // public share token, e.g. /i/x7Kp2m
  title       String
  description String?
  location    String?
  startsAt    DateTime
  endsAt      DateTime?
  rsvpDeadline DateTime?
  maxGuests   Int?                      // optional capacity limit
  allowPlusOnes Boolean @default(true)
  isOpen      Boolean  @default(true)   // host can close RSVPs
  hostId      String
  host        User     @relation(...)
  rsvps       Rsvp[]
  createdAt   DateTime @default(now())
}

model Rsvp {
  id           String     @id @default(cuid())
  invitationId String
  invitation   Invitation @relation(...)
  guestName    String
  guestEmail   String?
  status       RsvpStatus // YES | NO | MAYBE
  plusOnes     Int        @default(0)
  message      String?
  editToken    String     @unique       // lets a guest change their answer later
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@unique([invitationId, guestEmail]) // one RSVP per email per event
}
```

## 4. Pages & API

### Pages
| Route | Purpose |
|---|---|
| `/` | Landing page + login |
| `/dashboard` | Host's invitations with RSVP counts (going / declined / maybe) |
| `/dashboard/new` | Create invitation form |
| `/dashboard/[id]` | Manage one invitation: edit details, view/export guest list, copy share link, close RSVPs |
| `/i/[slug]` | **Public invitation page** — event details + RSVP form |
| `/i/[slug]/rsvp/[editToken]` | Guest edits their existing RSVP |

### API (Next.js route handlers / server actions)
- `POST /api/invitations` — create (auth required)
- `PATCH /api/invitations/[id]` — update / close (auth + ownership check)
- `DELETE /api/invitations/[id]` — delete (auth + ownership check)
- `GET /api/invitations/[id]/rsvps` — list responses, CSV export (auth)
- `POST /api/i/[slug]/rsvp` — submit RSVP (public, rate-limited)
- `PATCH /api/rsvp/[editToken]` — guest updates their RSVP (public)

## 5. Build Phases

### Phase 1 — Core MVP (no auth)
1. Scaffold Next.js + Prisma + Tailwind; set up SQLite schema and migrations.
2. Create-invitation form → generates slug → public invitation page at `/i/[slug]`.
3. RSVP form on the public page (name, status, plus-ones, message) with Zod validation.
4. A simple host view at `/dashboard/[id]` (link-secret based, like the guest link but with a separate admin token) showing the response list and counts.

**Deliverable:** you can create an invitation, send the link to friends, and watch RSVPs come in.

### Phase 2 — Accounts & Management
5. Add Auth.js login; tie invitations to a User; real `/dashboard` listing all events.
6. Edit/delete invitations, close RSVPs, RSVP deadline + capacity enforcement.
7. Guest edit-token flow so guests can change their answer.

### Phase 3 — Polish & Notifications
8. Email notifications to the host on new RSVPs; optional "send invitation by email" to a guest list (Resend).
9. CSV export of the guest list; duplicate-RSVP handling; rate limiting on public endpoints.
10. Invitation theming (cover image, color accent), Open Graph tags so shared links preview nicely.

### Phase 4 — Nice-to-haves (backlog)
- Calendar attachment (.ics) on the invitation page and in confirmation emails.
- Reminder emails before the RSVP deadline / event date.
- Per-guest invite links with pre-filled names and per-person tracking of opens.
- Waitlist when capacity is full; QR code for the share link.

## 6. Security & Edge Cases

- Slugs and edit tokens: ≥ 10 chars of URL-safe randomness (`nanoid`) — unguessable, since the link is the only protection on public pages.
- Ownership checks on every host API route; never trust the invitation ID from the client alone.
- Rate-limit the public RSVP endpoint and dedupe by email to prevent spam flooding a guest list.
- Closed/expired invitations must reject new RSVPs server-side, not just hide the form.
- Time zones: store UTC, display in the event's (or viewer's) local time zone.

## 7. Suggested Project Structure

```
src/
  app/
    (marketing)/page.tsx
    dashboard/...
    i/[slug]/...
    api/...
  components/        # forms, RSVP status badges, guest list table
  lib/               # prisma client, auth, validation schemas, slug/token helpers
prisma/
  schema.prisma
  migrations/
```

---

**Estimated effort:** Phase 1 is roughly a day of work; Phases 2–3 another 2–3 days. Phase 1 alone is already a usable product.
