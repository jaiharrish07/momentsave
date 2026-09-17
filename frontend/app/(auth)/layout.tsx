import Link from "next/link";
import { ReactNode } from "react";

/**
 * Auth-page layout: centered card on plain white.
 * Used by /login and /register.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="px-6 py-4 border-b border-slate-100">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-slate-900 hover:opacity-80 transition"
        >
          MomentSave
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
