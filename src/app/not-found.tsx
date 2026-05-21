import Link from "next/link";
import { LeafMark } from "@/components/LeafMark";

export const metadata = { title: "Not found — LEAF" };

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 text-center">
      <div className="pointer-events-none absolute inset-0 grid-bg" />
      <div className="pointer-events-none absolute left-1/2 top-[20%] h-[320px] w-[520px] -translate-x-1/2 glow-accent" />

      <div className="relative">
        <LeafMark size={44} />
        <div className="num mt-8 text-6xl font-bold tracking-tight md:text-7xl">404</div>
        <h1 className="display mt-2 text-2xl font-bold md:text-3xl">This page went off-piste.</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-[var(--color-muted)]">
          The page you&apos;re looking for doesn&apos;t exist, was moved, or is private.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className="rounded-xl bg-[var(--color-accent)] px-6 py-3 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]">
            Back home
          </Link>
          <Link href="/explore" className="rounded-xl border border-[var(--color-border)] px-6 py-3 text-sm font-medium hover:border-[var(--color-accent)]">
            Explore LEAF
          </Link>
        </div>
      </div>
    </div>
  );
}
