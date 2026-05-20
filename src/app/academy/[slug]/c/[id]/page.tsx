import Link from "next/link";
import { notFound } from "next/navigation";
import { ChatThread, ExternalReply } from "@/components/Chat";
import { getPublicConversation } from "@/lib/chat";

export const dynamic = "force-dynamic";

export default async function PublicThreadPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const conv = await getPublicConversation(id);
  if (!conv || conv.academy.slug !== slug) notFound();

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4 md:px-12">
        <Link href={`/academy/${slug}`} className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg font-black" style={{ background: conv.academy.logoColor, color: "#0a0c10" }}>{conv.academy.name[0]}</div>
          <span className="font-semibold">{conv.academy.name}</span>
        </Link>
        <span className="text-sm text-[var(--color-muted)]">Messages</span>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-10">
        <h1 className="text-xl font-bold">Your conversation with {conv.academy.name}</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Ask about your application, documents, payments or schedule. The coaching staff will reply here.
        </p>

        <div className="card mt-6 p-5">
          <ChatThread messages={conv.messages} viewerSide="external" />
        </div>
        <div className="card mt-4 p-5">
          <ExternalReply conversationId={conv.id} />
        </div>

        <p className="mt-4 text-center text-xs text-[var(--color-muted)]">Keep this page link to return to your conversation.</p>
      </div>
    </div>
  );
}
