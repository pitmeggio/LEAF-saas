import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicAcademy } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ThanksPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ c?: string }> }) {
  const { slug } = await params;
  const { c } = await searchParams;
  const academy = await getPublicAcademy(slug);
  if (!academy) notFound();

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <div
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
          style={{ background: "#7cff6b1a", color: "#7cff6b", border: "1px solid #7cff6b40" }}
        >
          ✓
        </div>
        <h1 className="text-2xl font-bold">Application submitted</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Thanks — your application to <span className="text-[var(--color-fg)]">{academy.name}</span> has been received.
          The coaching staff will review your profile and get back to you.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3">
          {c && (
            <Link href={`/academy/${academy.slug}/c/${c}`} className="inline-block w-full rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]">
              Open your message thread →
            </Link>
          )}
          <Link href={`/academy/${academy.slug}`} className="inline-block rounded-lg border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium hover:bg-[var(--color-surface)]">
            ← Back to {academy.name}
          </Link>
        </div>
      </div>
    </div>
  );
}
