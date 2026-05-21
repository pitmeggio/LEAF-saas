# LEAF — Pilot-ready checklist

Goal: take LEAF from "pilot-ready MVP" to a real pilot with **one** academy and a
handful of real athletes. The product is no longer the bottleneck — validation is.

## 1. Tech hardening (small, real)
- [ ] Set `AUTH_SECRET` on Vercel (a long random value). Without it, a dev fallback
      key signs sessions.
- [ ] Turn on real email: set `RESEND_API_KEY` + a verified `EMAIL_FROM` sender
      domain in Resend. Until then, notifications are recorded as "queued" only.
- [ ] Passwords for pilot accounts: the "claim on first sign-in" path is a hole.
      For a controlled pilot, pre-set passwords (see `prisma/set-demo-passwords.ts`
      pattern) **or** ship the set/reset-password-via-email flow (~half a day).
- [ ] Provision a **clean tenant** for the real academy via the super-admin portal
      (do not show them the Trysil demo data). Create their owner account there.
- [ ] Promote the latest deployment to Production on Vercel; verify the live URL.

## 2. Privacy minimum (before the first real athlete) — non-negotiable
- [x] Consent checkbox on create-profile and apply (athlete + guardian for minors).
- [x] Draft privacy page at `/privacy`.
- [ ] Replace the `/privacy` draft with a real, jurisdiction-specific (GDPR) policy
      reviewed by legal counsel.
- [ ] Confirm data is only pulled on the athlete's own action (it is) — no bulk
      harvesting / re-publishing of federation lists.

## 3. Pilot operations (the actual GTM step)
- [ ] Pick **one** friendly academy (ski, Alps/Nordics).
- [ ] Onboard 5–10 real athletes (bulk CSV import or "Apply with LEAF").
- [ ] Put the "Apply with LEAF" button (Dashboard → Recruiting) on their site.
- [ ] Define success metrics: applications received, triage time saved, profiles
      completed, coach/athlete feedback.

## 4. Out of scope for the pilot (don't get distracted)
Payments/Stripe, App Store / native app, ATP/tennis connector, advanced ML.

## Data note (FIS)
Pulling a single athlete's **own** published record, on their action/consent, is
defensible. Bulk-harvesting and re-publishing the whole list is not — and doesn't
scale technically. For scale, pursue a data agreement with FIS and/or national
federations (also a GTM wedge).
