import axios, { AxiosError } from "axios";

/**
 * Central axios instance for talking to the MomentSave backend.
 * All requests include cookies (session auth).
 */
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Global 401 handler: if any request comes back unauthorized on a page
 * that expected auth, redirect to /login.
 *
 * Excludes /api/auth/me — thats how we CHECK auth state, so a 401 there
 * is expected and shouldnt trigger a redirect.
 */
if (typeof window !== "undefined") {
  api.interceptors.response.use(
    (response) => response,
    (err: AxiosError) => {
      if (err.response?.status === 401) {
        const url = err.config?.url ?? "";
        const isAuthCheck = url.includes("/api/auth/me");
        const alreadyOnLogin = window.location.pathname === "/login";
        if (!isAuthCheck && !alreadyOnLogin) {
          window.location.href = "/login";
        }
      }
      return Promise.reject(err);
    }
  );
}

/**
 * Standard shape of backend error responses.
 */
export type BackendError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

/**
 * Extract a friendly error message from any error.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const backendError = err.response?.data as BackendError | undefined;
    if (backendError?.error?.message) {
      return backendError.error.message;
    }
    if (err.message) return err.message;
  }
  if (err instanceof Error) return err.message;
  return "An unknown error occurred";
}

/**
 * Extract the error code (e.g. UNAUTHORIZED, FORBIDDEN, VALIDATION_ERROR).
 */
export function getErrorCode(err: unknown): string | null {
  if (err instanceof AxiosError) {
    const backendError = err.response?.data as BackendError | undefined;
    return backendError?.error?.code ?? null;
  }
  return null;
}
