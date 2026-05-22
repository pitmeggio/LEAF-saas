# LEAF — Architecture north star

**LEAF is a scalable, multi-tenant SaaS / OS engine — not custom software for one
academy.** Trysil Race Academy is our first *pilot tenant*, never a special case.
Every decision below is judged against one question: _does this generalise to any
academy via configuration, or does it hardcode one academy's logic?_ The second is
not allowed.

## The 6 principles

1. **Demo data is replaceable, never hardcoded.** Keep UI, layout, reusable
   components, navigation and real product flows. Seed/fake data lives in
   `prisma/seed.ts` and is swappable — no academy-specific data baked into code.
2. **Trysil = first pilot tenant.** It's configured (branding, logo, colours,
   slug, packages, groups, permissions, application & recruiting rules), not coded.
3. **Multi-tenant isolation.** Everything scopes by `academyId`: users, athletes,
   applications, groups, payments, reports, settings. No academy-specific branches.
4. **Config-driven OS.** Academies customise without code changes: group rules
   (points/age/level), FIS thresholds, application forms, required documents,
   packages, payment flows, role permissions, feature flags, branding.
5. **Super-admin panel.** LEAF-internal control: create/approve academy, activate
   modules, manage plans, feature flags, branding, billing, user limits.
6. **Build for scale.** Generalise into reusable, config-driven modules. A SaaS
   engine, not per-academy software.

## Current state (what already follows this)

- **Multi-tenant scoping** — all tenant tables carry `academyId`; `requireAcademyId()`
  funnels every scoped query (`src/lib/auth.ts`). super_admin is platform-level.
- **Super-admin portal** (`/super-admin`) — create academy, request→provision
  lifecycle, account management, per-tenant config, plans.
- **Config-driven (in place):** per-tenant **feature flags** (recruiting / public
  profiles / finance / chat), **plan tiers** (`lib/plans.ts`), **group assignment
  rules** (points/age/level/discipline per group), **branding** (logo colour,
  tagline, description, contact), **athlete limit**.
- **Sport-aware** config (`lib/sport.ts`) — ski/tennis labels & ranking semantics,
  not hardcoded to skiing.
- **Provider seam** — FIS data behind `FisProvider` (`lib/fis/`), swappable.

## Still to make config-driven (next, in this order)

- [ ] **Required documents** per academy (today `REQUIRED_DOC_TYPES` is a global
      constant — move to per-tenant config).
- [ ] **Application form fields** per academy (which fields are shown/required).
- [ ] **Payment flow / schedule** rules per academy/package.
- [ ] **Role permissions** beyond admin/coach (owner/staff, granular).
- [ ] **Clean demo↔real separation** — provision Trysil as a real tenant distinct
      from seed/demo academies; never show demo data to a real tenant.

## Rule of thumb for every new feature

> If it can't be turned on/off or shaped per academy from config (DB + super-admin),
> it doesn't ship as hardcoded. Add the config seam first.
