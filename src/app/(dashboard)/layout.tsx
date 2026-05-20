import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { getCurrentUser } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <>
      <Sidebar
        user={{ name: user.name, role: user.role, academy: user.academy?.name ?? "—" }}
      />
      <main className="ml-60 min-h-screen">{children}</main>
    </>
  );
}
