import { redirect } from "next/navigation";
import { getSessionUser } from "@/shared/lib/auth";
import { AppShell } from "@/shared/components/layout/app-shell";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
    const user = await getSessionUser();
    if (!user) redirect("/auth/login");
    return <AppShell>{children}</AppShell>;
}
