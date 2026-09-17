"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      router.replace("/events");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading...</p>
      </main>
    );
  }

  if (user) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-slate-500">Redirecting...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white flex items-center justify-center px-6">
      <div className="max-w-md w-full">
        <div className="mb-12">
          <h1 className="text-5xl font-bold tracking-tight text-slate-900">
            MomentSave
          </h1>
          <p className="text-slate-600 mt-3 text-lg">
            Share event photos with a PIN. Nothing to install.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/login"
            className="block w-full text-center px-6 py-3 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="block w-full text-center px-6 py-3 rounded-lg border border-slate-200 text-slate-900 font-medium hover:bg-slate-50 transition-colors"
          >
            Create admin account
          </Link>
        </div>

        <div className="mt-12 pt-6 border-t border-slate-100">
          <p className="text-sm text-slate-500 text-center">
            Have a gallery PIN?{" "}
            <Link href="#" className="text-slate-900 underline underline-offset-2">
              Open with token
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
