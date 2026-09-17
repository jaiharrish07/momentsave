"use client";

import { createContext, useContext, ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { User } from "@/lib/types";

type AuthContextValue = {
  user: User | null | undefined;
  isLoading: boolean;
  login: (input: { email: string; password: string }) => Promise<User>;
  register: (input: { name: string; email: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Auth provider — wraps the app under the React Query provider.
 * Internally uses React Query for server state + mutations.
 * Components consume it via useAuth().
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async (): Promise<User | null> => {
      try {
        const res = await api.get<{ data: { user: User } }>("/api/auth/me");
        return res.data.data.user;
      } catch {
        return null;
      }
    },
    staleTime: 60 * 1000,
  });

  const loginMut = useMutation({
    mutationFn: async (input: { email: string; password: string }) => {
      const res = await api.post<{ data: { user: User; message: string } }>(
        "/api/auth/login",
        input
      );
      return res.data.data.user;
    },
    onSuccess: (user) => qc.setQueryData(["auth", "me"], user),
  });

  const registerMut = useMutation({
    mutationFn: async (input: { name: string; email: string; password: string }) => {
      const res = await api.post<{ data: { user: User; message: string } }>(
        "/api/auth/register",
        input
      );
      return res.data.data.user;
    },
    onSuccess: (user) => qc.setQueryData(["auth", "me"], user),
  });

  const logoutMut = useMutation({
    mutationFn: async () => {
      await api.post("/api/auth/logout");
    },
    onSuccess: () => {
      qc.setQueryData(["auth", "me"], null);
      qc.clear();
    },
  });

  const value: AuthContextValue = {
    user: meQuery.data,
    isLoading: meQuery.isLoading,
    login: (input) => loginMut.mutateAsync(input),
    register: (input) => registerMut.mutateAsync(input),
    logout: () => logoutMut.mutateAsync(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
