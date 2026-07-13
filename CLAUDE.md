@AGENTS.md

# LEAF — Sport Performance OS

LEAF is a **multi-tenant, multi-sport** management platform for sports academies.
One codebase serves every academy (tenant) and every sport. Today two tenants
run in production:

- **Trysil Race Academy** — alpine **ski** (FIS). The original build.
- **Sport Team Padova** — **tennis** (head coach Max Zanardi). The active focus.

The product is being extended for the **tennis world**. When you build, prefer
solutions that work for *any* tennis academy, not one-offs for Sport Team.

## Stack
- **Next.js 16** (App Router) + **React 19** + **TypeScript** (strict). ⚠️ Next 16
  has breaking changes vs older versions — see `@AGENTS.md`.
- **Prisma 7** + **Postgres on Supabase** (`@prisma/adapter-pg`).
- **Tailwind v4** (CSS custom properties for theming), **lucide-react** icons.
- Auth: signed session cookie (`academy_uid`), bcrypt passwords. No NextAuth.

## Golden rules (read before touching anything)
1. **NEVER commit secrets.** `.env` is gitignored — keep it that way. Only
   `.env.example` (placeholders) is tracked.
2. **NEVER develop against the production database.** Production is the shared
   Supabase project holding real academy data. Use **your own Supabase dev
   project** (free) in your local `.env`. See `docs/ONBOARDING.md`.
3. **Schema changes = `npx prisma db push`** then `npx prisma generate` then
   restart the dev server. On YOUR dev DB this is free; on prod it is gated and
   must be explicitly authorized by the project owner.
4. **Work on a branch, open a PR.** Never commit straight to `main`. Branch
   names: `tennis/<thing>`, `ski/<thing>`, `fix/<thing>`.
5. Every schema change is **additive** where possible; read layers guard missing
   tables/columns (`safe()` catching Prisma `P2021`/`P2022`) so a page never 500s
   before a migration is applied.

## Multi-tenant + multi-sport (the core patterns)
- **Tenant isolation is application-level** (no DB RLS). Every academy-scoped
  query funnels through `requireAcademyId()` / `requireAdmin()` /
  `requireBackOffice()` / `requireCoachId()` / `requireAthleteId()` in
  `src/lib/auth.ts`. Before any bare-id `update`/`delete`, first `findFirst({ where:{ id, academyId } })`.
- **Roles** (`User.role`): `super_admin` · `academy_admin` (Admin) · `office`
  (Segreteria) · `coach` · `athlete`.
- **Sport-awareness**: the academy's `sport` field decides behaviour. Tennis/padel
  academies use **calendar-year seasons** ("2026"); ski uses "2026/27". See
  `src/lib/season.ts` (format-detecting) + `src/lib/season-server.ts`.
- **Keep `pg` out of the browser bundle**: split client-safe types/pure logic
  (e.g. `*Types.ts`, `wellnessCore.ts`) from prisma reads (server files). A
  client component importing a file that imports `@/lib/db` breaks the build.

## Where things live
- `src/app/dashboard/**` — the academy OS (staff). `src/app/app/**` — the athlete
  mobile PWA. `src/app/super-admin/**` — platform owner.
- `src/lib/**` — read/query layers + engines (one folder per module: `board/`,
  `wellness/`, `timesheets/`, `trips/`, `anagrafica/`, `tennis/`, …).
- `src/app/*-actions.ts` — server actions (mutations). `src/components/**` — UI.
- `prisma/schema.prisma` — the data model.
- **Tennis specifics**: `src/lib/tennis/**` (rankings, canvas, dossier,
  TennisTalker connector), `src/app/dashboard/canvas/**` (cinematic athlete
  view), `TennisRankingCard`, tournament/season-plan models.

## External data
- **FIS** (ski) has a real provider seam. **Tennis rankings**: ATP/ITF are
  bot-blocked; the working public source is **TennisTalker** (`src/lib/tennis/tennisTalker.ts`)
  — search a player by name → real FIT classifica. Multi-year history is behind
  their paid membership; LEAF stamps the current classifica and builds the trend.

## Run it
```
npm install
# put your OWN Supabase dev DATABASE_URL in .env (copy .env.example)
npx prisma db push        # create the schema on YOUR dev DB
npm run db:seed           # optional demo data
npm run dev               # http://localhost:3000
```
Verify with `npx tsc --noEmit` and `npm run build` before opening a PR.

## Language
Product UI for the tennis tenant is **Italian**; ski (Trysil) is English. Match
the surrounding file. Code comments are English.
