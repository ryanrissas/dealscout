import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Sidebar from "@/components/shell/Sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const unread = await prisma.alert.count({ where: { userId: user.id, read: false } });
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar name={user.name} role={user.role} unread={unread} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1400px] px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
