# Invitation App — Development Plan

An app where a host creates event invitations, shares them with guests, and collects RSVPs **per household**, protected by a **PIN**. Separate **Node.js backend** and **React frontend**, fully translated in **English and German**.

## 1. Core Concept

- **Host** creates an event invitation (title, description, date/time, location, **image**).
- The host maintains a **guest list of households** (e.g., "Familie Müller" with members Anna, Tom, Lena). Each household gets a unique **PIN**.
- Guests open the shared invitation link, enter their **PIN**, and see their household: they RSVP for each member (attending / not attending), answer the host's **additional questions**, and can update their answer later by re-entering the PIN.
- One RSVP per household — the PIN ties the response to exactly one household. A **duplicate resolver** helps the host clean up overlapping or conflicting entries.
- Entire UI (and emails) available in **English and German**, switchable and auto-detected from the browser.

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Backend | Node.js + TypeScript, **Fastify** (or Express), REST API | Explicit requirement; Fastify gives validation + speed out of the box |
| Database | **Prisma ORM** with SQLite for dev, PostgreSQL for production | Zero-setup dev, painless prod swap |
| Frontend | **React 18 + TypeScript + Vite**, React Router, TanStack Query | Explicit requirement; Query handles API caching/refetching |
| Styling | Tailwind CSS + shadcn/ui | Fast, clean UI |
| i18n | **react-i18next** (frontend) + i18next on the backend (validation messages, emails) | De-facto standard, namespaced JSON translation files for `en` / `de` |
| Validation | Zod (schemas shared between frontend and backend via a small `shared/` package) | One source of truth for forms and API |
| Images | Upload endpoint → local disk in dev, S3-compatible storage in prod; `sharp` for resizing | Invitation hero/cover image |
| Auth (host) | Email + password with session cookies (or magic links later) | Guests never log in — the PIN is their access |

### Repo layout (monorepo)

```
/
├── backend/            # Fastify API
│   ├── src/
│   │   ├── routes/     # invitations, households, rsvp, questions, uploads, auth
│   │   ├── services/   # business logic incl. duplicate detection
│   │   ├── i18n/       # en.json, de.json (errors, emails)
│   │   └── lib/        # prisma client, pin generator, rate limiter
│   └── prisma/schema.prisma
├── frontend/           # React + Vite SPA
│   └── src/
│       ├── pages/      # Dashboard, InvitationEditor, GuestList, DuplicateResolver,
│       │               # PublicInvitation (PIN entry → household RSVP form)
│       ├── components/
│       └── i18n/       # en/*.json, de/*.json
└── shared/             # Zod schemas + TS types used by both
```

## 3. Data Model

```prisma
model User {                 // host
  id           String  @id @default(cuid())
  email        String  @unique
  passwordHash String
  locale       String  @default("en")   // "en" | "de"
  invitations  Invitation[]
}

model Invitation {
  id            String    @id @default(cuid())
  slug          String    @unique        // public link /i/[slug]
  title         String
  description   String?
  location      String?
  startsAt      DateTime
  rsvpDeadline  DateTime?
  imageUrl      String?                  // uploaded cover image
  isOpen        Boolean   @default(true)
  defaultLocale String    @default("de") // language the invitation page opens in
  hostId        String
  households    Household[]
  questions     Question[]
}

model Household {
  id           String   @id @default(cuid())
  invitationId String
  name         String                    // "Familie Müller"
  email        String?                   // optional contact
  pin          String                    // 6-digit, unique per invitation
  rsvpStatus   RsvpState @default(PENDING) // PENDING | RESPONDED
  message      String?                   // free-text note to the host
  respondedAt  DateTime?
  members      Member[]
  answers      Answer[]
  duplicateOfId String?                  // set by the duplicate resolver (merged into)

  @@unique([invitationId, pin])
}

model Member {
  id          String  @id @default(cuid())
  householdId String
  name        String
  attending   Boolean?                   // null = not answered yet
  answers     Answer[]                   // for per-person questions
}

model Question {                         // host-defined additional questions
  id           String       @id @default(cuid())
  invitationId String
  type         QuestionType // TEXT | SINGLE_CHOICE | MULTI_CHOICE | YES_NO
  scope        Scope        // PER_HOUSEHOLD | PER_MEMBER
  required     Boolean      @default(false)
  labelEn      String                   // question text in both languages
  labelDe      String
  optionsEn    String[]                 // for choice types
  optionsDe    String[]
  sortOrder    Int
  answers      Answer[]
}

model Answer {
  id          String  @id @default(cuid())
  questionId  String
  householdId String
  memberId    String?                    // set when scope = PER_MEMBER
  value       String                     // text or selected option key(s) as JSON

  @@unique([questionId, householdId, memberId])
}
```

## 4. Key Features in Detail

### 4.1 PIN-protected household RSVP
- Host adds households to the guest list; the backend generates a **6-digit numeric PIN** per household (unique within the invitation, collision-checked).
- Public flow: open `/i/[slug]` → invitation page (image, details) → "RSVP" → **enter PIN** → backend returns the matching household → guest sees their household members and the questions → submits.
- The PIN check issues a short-lived signed token (JWT, ~30 min) scoped to that household, so all RSVP requests are authorized without re-entering the PIN.
- **Brute-force protection:** rate limit PIN attempts per IP and per invitation (e.g., 5 tries / 10 min), constant-time comparison, lockout with a translated error message.
- Re-entering the PIN later lets the household **edit** their RSVP until the deadline or until the host closes the event.

### 4.2 One RSVP per household
- The RSVP form lists every member with an attending toggle; per-household questions appear once, per-member questions per attending member.
- Submitting again **overwrites** the household's previous answers (with `respondedAt` updated) — there is never more than one active response per household.
- Dashboard counts derive from members: attending / declined / pending, plus per-question answer summaries (e.g., meal choice totals).

### 4.3 Duplicate resolver
Duplicates happen when the host imports/types the guest list twice or creates overlapping households ("Familie Müller" vs. "Anna & Tom Müller").
- A background check (on guest-list changes) flags **candidate duplicates**: fuzzy name match on household and member names (normalized, Levenshtein/trigram similarity), identical emails, identical member sets.
- The **Duplicate Resolver page** shows candidate pairs side by side with their RSVP status and lets the host: **Merge** (pick the surviving household; members, answers, and the most recent RSVP are kept; the other gets `duplicateOfId` set and its PIN is deactivated), **Keep both** (dismiss the suggestion, never flag this pair again), or **Delete one**.
- If a merged-away PIN is entered by a guest, they are transparently redirected to the surviving household's RSVP.

### 4.4 Invitation image
- Host uploads a cover image in the invitation editor (`POST /api/uploads`, max ~5 MB, jpg/png/webp).
- Backend validates the type, strips EXIF, and resizes with `sharp` into web sizes (e.g., 1600px hero + 400px thumbnail).
- Shown as the hero of the public invitation page and as a thumbnail in the dashboard; also used for the Open Graph preview when the link is shared.

### 4.5 Additional questions
- Question builder in the invitation editor: add/reorder questions, choose type (free text, yes/no, single choice, multiple choice), scope (**per household** or **per member**), required flag.
- Each question and its options are entered **in both English and German** (two fields side by side); the public page shows the guest's current language.
- Typical uses: meal choice (per member), dietary restrictions (per member, text), "staying for breakfast?" (per household).
- Answers appear in the host's guest list and in the CSV export, one column per question.

### 4.6 Full i18n — English & German
- **Everything** translated: public invitation pages, RSVP flow, validation and error messages, host dashboard, emails, date/number formatting (`Intl` with `en-GB`/`de-DE`).
- Language detection order on the public page: URL `?lang=` → previous choice (localStorage) → invitation `defaultLocale` → browser language. Visible language toggle (EN/DE) on every page.
- Backend errors are returned as **message keys** (e.g., `errors.pin.invalid`) and translated on the client; emails are rendered server-side in the recipient's locale.
- Host-entered content (title, description, questions) is bilingual where it faces guests: questions are required in both languages; title/description get optional DE/EN variants with fallback.
- Translation files live in namespaced JSON (`common`, `rsvp`, `dashboard`, `errors`, `emails`); a CI check fails when keys are missing in either language.

## 5. API Sketch

**Host (session-authenticated, ownership-checked):**
- `POST /api/auth/register|login|logout`
- `POST/GET/PATCH/DELETE /api/invitations[/:id]`
- `POST /api/invitations/:id/households` (single + CSV bulk import) · `PATCH/DELETE /api/households/:id` · `POST /api/households/:id/regenerate-pin`
- `GET /api/invitations/:id/duplicates` · `POST /api/duplicates/:pairId/resolve` (merge | keep | delete)
- `POST/PATCH/DELETE /api/invitations/:id/questions[/:qid]`
- `GET /api/invitations/:id/rsvps` (+ `?format=csv`)
- `POST /api/uploads` (invitation image)

**Public (rate-limited):**
- `GET /api/i/:slug` — invitation details (no guest list!)
- `POST /api/i/:slug/pin` — verify PIN → household token
- `GET /api/i/:slug/household` — own household + questions (token required)
- `PUT /api/i/:slug/rsvp` — submit/overwrite household RSVP (token required)

## 6. Build Phases

### Phase 1 — Foundation
1. Monorepo scaffold (backend, frontend, shared), Prisma schema + migrations, host auth.
2. i18n wiring **from day one** (react-i18next + backend message keys, EN/DE files, language toggle) — retrofitting translations is painful.
3. Invitation CRUD with image upload; public invitation page at `/i/[slug]`.

### Phase 2 — Guest list & RSVP core
4. Household management (create, edit, CSV import) with PIN generation and a printable/exportable PIN list for the host.
5. PIN entry flow → household token → RSVP form with per-member attendance; overwrite-on-resubmit; deadline/closed enforcement server-side.
6. Dashboard with live counts and per-household response status.

### Phase 3 — Questions & duplicates
7. Question builder (bilingual) + answers in the RSVP flow; answer summaries and CSV export.
8. Duplicate detection service + resolver UI (merge / keep / delete, PIN redirect after merge).

### Phase 4 — Polish
9. Email notifications to the host on new RSVPs (localized); optional PIN delivery emails to households.
10. Rate limiting hardening, Open Graph tags, .ics calendar download, translation-completeness CI check, e2e tests (Playwright) covering the full RSVP flow in both languages.

## 7. Security Notes

- PINs: rate-limited verification, per-invitation uniqueness, never exposed in public API responses; household tokens are short-lived and scoped to one household of one invitation.
- All host routes verify ownership of the invitation/household, not just authentication.
- Public invitation endpoint returns event details only — never the guest list or other households' answers.
- Closed invitations and passed deadlines are enforced in the API, not just hidden in the UI.
- Uploaded images: MIME sniffing, size limits, EXIF stripped, served from a separate path/domain.

---

**Open assumption:** I read "image to resolve" as an image upload for the invitation (section 4.4). If you instead meant something image-based in the duplicate resolver or a CAPTCHA on the RSVP form, say so and I'll adjust the plan.
