"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * Dashboard shell — used by every authenticated page.
 * - Redirects to /login if not authed
 * - Renders top bar with user info + nav + logout
 * - Wraps children in a max-width container
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, logout } = useAuth();

  const isActive = (href: string) =>
    href === "/events"
      ? pathname === "/events" || pathname.startsWith("/events/")
      : pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace("/login");
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    );
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b-2 border-slate-900 bg-white sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 sm:gap-10 min-w-0">
            <Link
              href="/events"
              className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap hover:opacity-80 transition"
            >
              MomentSave
            </Link>
            <nav className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/events"
                className={`text-sm px-3 py-1.5 rounded-md font-medium transition ${
                  isActive("/events")
                    ? "text-slate-900 bg-slate-100"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                Events
              </Link>
              {user.role === "admin" && (
                <Link
                  href="/team-members"
                  className={`text-sm px-3 py-1.5 rounded-md font-medium transition ${
                    isActive("/team-members")
                      ? "text-slate-900 bg-slate-100"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Team
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            <div className="hidden sm:flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-semibold">
                {(user.name ?? user.email ?? "?").charAt(0).toUpperCase()}
              </div>
              <div className="text-right leading-tight">
                <p className="text-sm font-semibold text-slate-900 truncate max-w-[140px]">
                  {user.name ?? user.email ?? "Account"}
                </p>
                <p className="text-xs text-slate-500 capitalize">
                  {user.role.replace("_", " ")}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm px-3 py-1.5 rounded-md border border-slate-200 text-slate-700 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 font-medium transition whitespace-nowrap"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">{children}</div>
      </main>
    </div>
  );
}