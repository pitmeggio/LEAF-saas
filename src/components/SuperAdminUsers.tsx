"use client";

import { createContext, useContext, useEffect, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createUser, updateUser, setUserPassword, deleteUser, type Result } from "@/app/super-admin-actions";

const ROLES = [
  { value: "super_admin", label: "Super admin (platform)" },
  { value: "academy_admin", label: "Academy admin / owner" },
  { value: "coach", label: "Coach" },
  { value: "recruiter", label: "Recruiter" },
  { value: "athlete", label: "Athlete" },
] as const;

export const ROLE_LABEL: Record<string, string> = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));

type AcademyOption = { id: string; name: string };

const inp = "w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]";
const lbl = "mb-1 block text-xs text-[var(--color-muted)]";

const ModalCtx = createContext<() => void>(() => {});

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className={lbl}>{label}</label>{children}</div>;
}

function useSubmit() {
  const close = useContext(ModalCtx);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const submit = (fn: () => Promise<Result>) =>
    start(async () => { const r = await fn(); if (r.ok) { close(); router.refresh(); } else setError(r.error ?? "Something went wrong"); });
  return { pending, error, submit };
}

function Modal({ label, title, className, children }: { label: ReactNode; title: string; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  const overlay = (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 backdrop-blur-sm" onClick={close}>
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="card my-8 flex max-h-[calc(100dvh-4rem)] w-full max-w-lg flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-[14px] border-b border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-4">
            <h3 className="text-base font-semibold">{title}</h3>
            <button onClick={close} aria-label="Close" className="text-lg text-[var(--color-muted)] hover:text-[var(--color-fg)]">✕</button>
          </div>
          <div className="overflow-y-auto px-6 py-5">
            <ModalCtx.Provider value={close}>{children}</ModalCtx.Provider>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button className={className} onClick={() => setOpen(true)}>{label}</button>
      {open && typeof document !== "undefined" && createPortal(overlay, document.body)}
    </>
  );
}

function Footer({ pending, error, label = "Save" }: { pending: boolean; error: string | null; label?: string }) {
  return (
    <>
      {error && <p className="mt-3 text-sm text-[#f87171]">{error}</p>}
      <div className="mt-4 flex justify-end">
        <button type="submit" disabled={pending} className="rounded-lg bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)] disabled:opacity-50">
          {pending ? "Saving…" : label}
        </button>
      </div>
    </>
  );
}

function RoleAcademyFields({ academies, role, setRole, academyId }: {
  academies: AcademyOption[]; role: string; setRole: (r: string) => void; academyId?: string | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Role">
        <select name="role" className={inp} value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </Field>
      <Field label="Academy">
        <select name="academyId" className={inp} defaultValue={academyId ?? ""} disabled={role === "super_admin"}>
          <option value="">{role === "super_admin" ? "— platform —" : "Select academy…"}</option>
          {academies.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
    </div>
  );
}

// ── Create user ──────────────────────────────────────────────────────────────
export function CreateUserButton({ academies }: { academies: AcademyOption[] }) {
  return (
    <Modal label="+ New account" title="Create account" className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-[#0a0c10] hover:bg-[var(--color-accent-dim)]">
      <CreateUserForm academies={academies} />
    </Modal>
  );
}

function CreateUserForm({ academies }: { academies: AcademyOption[] }) {
  const { pending, error, submit } = useSubmit();
  const [role, setRole] = useState("academy_admin");
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        submit(() => createUser({
          name: String(fd.get("name") ?? ""),
          email: String(fd.get("email") ?? ""),
          role: String(fd.get("role") ?? "academy_admin"),
          academyId: String(fd.get("academyId") ?? ""),
          password: String(fd.get("password") ?? ""),
        }));
      }}
    >
      <Field label="Full name"><input name="name" className={inp} required /></Field>
      <Field label="Email"><input name="email" type="email" className={inp} required /></Field>
      <RoleAcademyFields academies={academies} role={role} setRole={setRole} />
      <Field label="Password (optional)">
        <input name="password" type="text" className={inp} placeholder="Leave blank → set on first sign-in" />
      </Field>
      <Footer pending={pending} error={error} label="Create account" />
    </form>
  );
}

// ── Edit user ────────────────────────────────────────────────────────────────
type PUser = { id: string; name: string; email: string; role: string; academyId: string | null };

export function EditUserButton({ user, academies }: { user: PUser; academies: AcademyOption[] }) {
  return (
    <Modal label="Edit" title="Edit account" className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-2)]">
      <EditUserForm user={user} academies={academies} />
    </Modal>
  );
}

function EditUserForm({ user, academies }: { user: PUser; academies: AcademyOption[] }) {
  const { pending, error, submit } = useSubmit();
  const [role, setRole] = useState(user.role);
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        submit(() => updateUser({
          id: user.id,
          name: String(fd.get("name") ?? ""),
          email: String(fd.get("email") ?? ""),
          role: String(fd.get("role") ?? user.role),
          academyId: String(fd.get("academyId") ?? ""),
        }));
      }}
    >
      <Field label="Full name"><input name="name" className={inp} defaultValue={user.name} required /></Field>
      <Field label="Email"><input name="email" type="email" className={inp} defaultValue={user.email} required /></Field>
      <RoleAcademyFields academies={academies} role={role} setRole={setRole} academyId={user.academyId} />
      <Footer pending={pending} error={error} />
    </form>
  );
}

// ── Reset password ───────────────────────────────────────────────────────────
export function ResetPasswordButton({ user }: { user: { id: string; name: string } }) {
  return (
    <Modal label="Password" title={`Set password — ${user.name}`} className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-surface-2)]">
      <ResetPasswordForm id={user.id} />
    </Modal>
  );
}

function ResetPasswordForm({ id }: { id: string }) {
  const { pending, error, submit } = useSubmit();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        submit(() => setUserPassword({ id, password: String(fd.get("password") ?? "") }));
      }}
    >
      <Field label="New password">
        <input name="password" type="text" className={inp} placeholder="Leave blank → clear (claim on next sign-in)" />
      </Field>
      <p className="text-xs text-[var(--color-muted)]">Min 8 characters. Blank clears the credential so the user sets it themselves at next sign-in.</p>
      <Footer pending={pending} error={error} label="Set password" />
    </form>
  );
}

// ── Delete user ──────────────────────────────────────────────────────────────
export function DeleteUserButton({ user }: { user: { id: string; name: string } }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete ${user.name}? This cannot be undone.`)) return;
        start(async () => { const r = await deleteUser({ id: user.id }); if (!r.ok) alert(r.error); router.refresh(); });
      }}
      className="rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs font-medium text-[#f87171] hover:bg-[#f8717115] disabled:opacity-50"
    >
      Delete
    </button>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const isSuper = role === "super_admin";
  const color = isSuper ? "#7CFF6B" : "#9aa4b2";
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: `${color}1a`, color }}>
      {ROLE_LABEL[role] ?? role}
    </span>
  );
}
