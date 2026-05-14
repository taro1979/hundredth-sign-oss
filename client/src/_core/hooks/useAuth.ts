import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

/** Check whether a tRPC error is an authentication failure (not transient). */
function isAuthError(error: unknown): boolean {
  if (!(error instanceof TRPCClientError)) return false;
  return error.message === UNAUTHED_ERR_MSG || error.data?.code === "UNAUTHORIZED";
}

/** Check whether a tRPC error is a rate-limit / transient server error. */
function isTransientError(error: unknown): boolean {
  if (!(error instanceof TRPCClientError)) return false;
  return (
    error.data?.code === "TOO_MANY_REQUESTS" ||
    error.data?.httpStatus === 429 ||
    error.data?.code === "INTERNAL_SERVER_ERROR"
  );
}

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const resolvedRedirectPath = useMemo(() => {
    if (redirectPath) return redirectPath;
    if (!redirectOnUnauthenticated) return "/";
    try {
      return getLoginUrl();
    } catch {
      return "/";
    }
  }, [redirectOnUnauthenticated, redirectPath]);
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    // Retry transient errors (429, 500) up to 2 times, but not auth errors
    retry: (failureCount, error) => {
      if (isAuthError(error)) return false;
      return failureCount < 2;
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
    refetchOnWindowFocus: false,
    // Cache successful auth data for 5 min so transient failures don't
    // immediately flip isAuthenticated to false
    staleTime: 5 * 60 * 1000,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      localStorage.removeItem("hundredth-sign-org-id");
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => ({
    user: meQuery.data ?? null,
    loading: meQuery.isLoading || logoutMutation.isPending,
    error: meQuery.error ?? logoutMutation.error ?? null,
    isAuthenticated: Boolean(meQuery.data),
  }), [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === resolvedRedirectPath) return;
    // Don't redirect on transient errors (429, network) — only on real auth failures
    if (meQuery.error && isTransientError(meQuery.error)) return;

    window.location.href = resolvedRedirectPath;
  }, [
    redirectOnUnauthenticated,
    resolvedRedirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    meQuery.error,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}
