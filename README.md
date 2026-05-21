# Academy OS + Leaf Profiles

A multi-tenant academy management app (Academy OS) plus public athlete recruiting profiles (Leaf Profiles). Next.js + Prisma + PostgreSQL (Supabase). Academy OS writes the data; Leaf Profiles shows the approved public parts. Both share **one** database.

## Simple setup

You only ever need **one** secret: a Supabase connection string called `DATABASE_URL`.

### A. Get your database string from Supabase
1. Go to [supabase.com](https://supabase.com) → create a project (remember the **database password** you set).
2. In the project, click **Connect** (top bar) → choose **Transaction pooler**.
3. Copy the connection string. It looks like:
   `postgresql://postgres.abcd1234:YOUR-PASSWORD@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?pgbouncer=true`
   - the username starts with `postgres.` followed by your project id — **not** just `postgres`
   - the port is `6543` (the **Transaction pooler** — required for serverless hosts like Vercel)
   - replace the password placeholder with your real database password

   > Use the **Transaction pooler (6543)**, not the Session pooler (5432): on Vercel the
   > session pooler quickly hits its connection limit (*"max clients reached in session mode"*).

### B. Run it locally
```bash
cp .env.example .env        # then paste your string into .env as DATABASE_URL
npm install                 # installs everything + generates the database client
npm run db:push             # creates the tables in your database
npm run db:seed             # (optional) adds demo data
npm run dev                 # start the app at http://localhost:3000
```

If `DATABASE_URL` is missing or wrong, the app shows a clear error telling you to fix `.env`.

### C. Deploy to Vercel
1. Push this project to GitHub.
2. On [vercel.com](https://vercel.com) → **Add New → Project** → import the repo.
3. Open **Settings → Environment Variables** and add **one** variable:
   - **Name:** `DATABASE_URL`
   - **Value:** your Supabase **Session pooler** string (same format as above)
   - apply it to **Production** (and **Preview** if you want preview deploys)
4. Click **Deploy**.

The database tables are created by running `npm run db:push` **once** (step B). If you start from a brand-new empty Supabase database, run `npm run db:push` against it one time before the app can read/write data.

> Tips:
> - Don't add `?sslmode=...` to the string — the app handles the secure connection for you.
> - Use the **Session pooler** string (port 5432); avoid the `db.<id>.supabase.co` "direct" string (it doesn't work on most cloud builders).
> - If you ever see a login/database error like *"password authentication failed"*, your `DATABASE_URL` password is wrong — re-copy the Session pooler string from Supabase (reset the database password under **Settings → Database** if unsure) and update it in `.env` (local) and in Vercel **Environment Variables** (then redeploy).

### Useful commands
| Command | What it does |
|---|---|
| `npm run dev` | Run the app locally |
| `npm run db:push` | Create/update database tables from the schema |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:seed` | Load demo data |
| `npm run build` | Production build (also syncs the database) |

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
