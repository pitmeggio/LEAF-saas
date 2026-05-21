import { getPlatformUsers, getAcademyOptions } from "@/lib/superadmin";
import {
  CreateUserButton, EditUserButton, ResetPasswordButton, DeleteUserButton, RoleBadge,
} from "@/components/SuperAdminUsers";

export const dynamic = "force-dynamic";

export default async function SuperAdminPeoplePage() {
  const [users, academies] = await Promise.all([getPlatformUsers(), getAcademyOptions()]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">People</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Owner, admin, coach and recruiter accounts across the platform.</p>
        </div>
        <CreateUserButton academies={academies} />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-muted)]">
              <th className="px-5 py-3 font-medium">Name</th>
              <th className="px-3 py-3 font-medium">Email</th>
              <th className="px-3 py-3 font-medium">Role</th>
              <th className="px-3 py-3 font-medium">Academy</th>
              <th className="px-3 py-3 font-medium">Credential</th>
              <th className="px-3 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-[var(--color-muted)]">No accounts yet.</td></tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-t border-[var(--color-border)] first:border-t-0">
                <td className="px-5 py-3 font-medium">{u.name}</td>
                <td className="px-3 py-3 text-[var(--color-muted)]">{u.email}</td>
                <td className="px-3 py-3"><RoleBadge role={u.role} /></td>
                <td className="px-3 py-3 text-[var(--color-muted)]">{u.academyName ?? <span className="opacity-60">— platform —</span>}</td>
                <td className="px-3 py-3">
                  {u.hasPassword
                    ? <span className="text-xs text-[var(--color-muted)]">Set</span>
                    : <span className="text-xs" style={{ color: "#f59e0b" }}>Claim on first sign-in</span>}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <ResetPasswordButton user={{ id: u.id, name: u.name }} />
                    <EditUserButton user={{ id: u.id, name: u.name, email: u.email, role: u.role, academyId: u.academyId }} academies={academies} />
                    <DeleteUserButton user={{ id: u.id, name: u.name }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
