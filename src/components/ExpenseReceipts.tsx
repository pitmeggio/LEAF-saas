"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteExpenseReceipt } from "@/app/expense-actions";

type Receipt = { id: string; fileName: string; fileMime: string };

const ACCEPT = "image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.heic";

// PowerOffice-style receipt strip for an expense row. Shows each attached
// kvittering as a thumbnail (image) or a PDF chip — click to open full size.
// When `canEdit`, a coach can snap/upload more (the file input uses capture so
// phones open the camera straight to the receipt) or remove them.
export function ExpenseReceipts({ expenseId, receipts, canEdit }: { expenseId: string; receipts: Receipt[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(`/api/expenses/${expenseId}/receipt`, { method: "POST", body: fd });
      const json = await res.json().catch(() => ({ ok: false }));
      if (res.ok && json.ok) {
        router.refresh();
      } else {
        setErr(json.error ?? "Upload failed");
      }
    } catch {
      setErr("Upload failed — check your connection.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const remove = (id: string) => {
    if (!confirm("Remove this receipt?")) return;
    start(async () => {
      const r = await deleteExpenseReceipt(id);
      if (r.ok) router.refresh();
      else setErr(r.error ?? "Could not remove");
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {receipts.map((r) => {
        const isImage = r.fileMime.startsWith("image/") && r.fileMime !== "image/heic" && r.fileMime !== "image/heif";
        const href = `/api/expenses/receipt/${r.id}`;
        return (
          <span key={r.id} className="group relative inline-flex">
            <a href={href} target="_blank" rel="noopener" title={r.fileName} className="block">
              {isImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={href} alt={r.fileName} className="h-9 w-9 rounded-md border border-[var(--color-border)] object-cover" />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[9px] font-semibold text-[var(--color-muted)]">
                  {r.fileMime === "application/pdf" ? "PDF" : "IMG"}
                </span>
              )}
            </a>
            {canEdit && (
              <button
                type="button"
                onClick={() => remove(r.id)}
                disabled={pending}
                aria-label={`Remove ${r.fileName}`}
                className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-[#f87171] text-[10px] font-bold text-white group-hover:flex"
              >
                ×
              </button>
            )}
          </span>
        );
      })}

      {canEdit && (
        <>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            title="Add a receipt photo (camera or file)"
            className="flex h-9 items-center gap-1 rounded-md border border-dashed border-[var(--color-border)] px-2 text-[11px] font-medium text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-fg)] disabled:opacity-50"
          >
            {uploading ? "Uploading…" : "📷 Receipt"}
          </button>
          <input ref={fileInput} type="file" accept={ACCEPT} capture="environment" onChange={onPick} className="hidden" />
        </>
      )}

      {receipts.length === 0 && !canEdit && <span className="text-xs text-[var(--color-muted)]/60">—</span>}
      {err && <span className="w-full text-[10px] text-[#f87171]">{err}</span>}
    </div>
  );
}
