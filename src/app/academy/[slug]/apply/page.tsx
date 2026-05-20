import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicAcademy } from "@/lib/queries";
import { ApplyForm } from "@/components/ApplyForm";

export const dynamic = "force-dynamic";

export default async function ApplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ package?: string }>;
}) {
  const { slug } = await params;
  const { package: pkg } = await searchParams;
  const academy = await getPublicAcademy(slug);
  if (!academy) notFound();

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4 md:px-12">
        <Link href={`/academy/${academy.slug}`} className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg font-black"
            style={{ background: academy.logoColor, color: "#0a0c10" }}
          >
            {academy.name[0]}
          </div>
          <span className="font-semibold">{academy.name}</span>
        </Link>
        <Link href={`/academy/${academy.slug}`} className="text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]">
          ← Back
        </Link>
      </header>

      <div className="mx-auto max-w-xl px-5 py-10 md:py-12">
        <h1 className="text-2xl font-bold tracking-tight">Apply to {academy.name}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Have a FIS code? Tick the box and your sports CV builds itself. Otherwise, fill in the basics.
        </p>

        <div className="mt-6">
          <ApplyForm
            slug={academy.slug}
            packages={academy.packages.map((p) => ({ id: p.id, name: p.name, price: p.price, period: p.period }))}
            defaultPackage={pkg}
          />
        </div>
      </div>
    </div>
  );
}
