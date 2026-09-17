"use client";

import { use, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  usePublicGalleryPreview,
  useVerifyPin,
} from "@/hooks/usePublicGallery";
import { getErrorMessage, getErrorCode } from "@/lib/api";

export default function GalleryPinEntryPage({
  params,
}: {
  params: Promise<{ publicToken: string }>;
}) {
  const { publicToken } = use(params);
  const router = useRouter();

  const preview = usePublicGalleryPreview(publicToken);
  const verifyMut = useVerifyPin(publicToken);

  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await verifyMut.mutateAsync(pin);
      router.replace(`/gallery/${publicToken}/view`);
    } catch (err) {
      const code = getErrorCode(err);
      if (code === "TOO_MANY_REQUESTS") {
        setError(
          "Too many attempts. Please wait 15 minutes before trying again."
        );
      } else {
        setError(getErrorMessage(err));
      }
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="px-6 py-5">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-slate-900"
        >
          MomentSave
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-sm">
          {preview.isLoading ? (
            <p className="text-sm text-slate-500 text-center">Loading...</p>
          ) : preview.isError ? (
            <div className="text-center">
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                Gallery not found
              </h1>
              <p className="text-slate-500">
                The link may be incorrect or the gallery may not be published
                yet.
              </p>
            </div>
          ) : (
            <div>
              <div className="mb-8 text-center">
                <p className="text-sm text-slate-500 mb-2">Photo gallery</p>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                  {preview.data?.title}
                </h1>
                <p className="text-slate-500 mt-3">
                  Enter the 6-digit PIN to view photos.
                </p>
              </div>

              <form onSubmit={onSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="pin"
                    className="block text-sm font-medium text-slate-900 mb-1.5"
                  >
                    PIN
                  </label>
                  <input
                    id="pin"
                    type="text"
                    inputMode="numeric"
                    pattern="\d{4,10}"
                    required
                    autoFocus
                    autoComplete="off"
                    value={pin}
                    onChange={(e) =>
                      setPin(e.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                    className="block w-full px-3 py-3 text-2xl font-mono tracking-widest text-center rounded-lg border border-slate-200 text-slate-900 placeholder:text-slate-300 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 focus:outline-none transition"
                    placeholder="000000"
                  />
                </div>

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={verifyMut.isPending || pin.length < 4}
                  className="w-full px-4 py-3 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
                >
                  {verifyMut.isPending ? "Verifying..." : "View gallery"}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>

      <footer className="px-6 py-4 text-center">
        <p className="text-xs text-slate-400">
          Trouble accessing this gallery? Contact the event organizer.
        </p>
      </footer>
    </div>
  );
}