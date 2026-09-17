import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AuthService } from "../services/AccountService";
import type { User } from "../types/account";
import { onUnauthorized, session } from "./session";

/**
 * - `loading`    working out which of the others applies
 * - `unreachable` the API did not answer, so we cannot know; offer a retry rather than a sign-in form
 * - `open`       the backend has no accounts yet: the CMS runs without sign-in, as it always did
 * - `signedOut`  accounts exist and nobody is signed in
 * - `signedIn`   `user` is set
 */
export type AuthStatus = "loading" | "unreachable" | "open" | "signedOut" | "signedIn";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** True for administrators, and while the backend has no accounts (everyone is the operator then). */
  isAdmin: boolean;
  /** The client an administrator is working as; empty for "everything". Always empty for client users. */
  scope: string;
  setScope: (clientId: string) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [scope, setScopeState] = useState(session.getScope());
  const resolving = useRef(false);

  const resolve = useCallback(async () => {
    if (resolving.current) return;
    resolving.current = true;
    try {
      const required = await AuthService.loginRequired();
      if (required === null) {
        setStatus("unreachable");
        return;
      }
      if (!required) {
        session.setToken("");
        setUser(null);
        setStatus("open");
        return;
      }
      if (!session.getToken()) {
        setUser(null);
        setStatus("signedOut");
        return;
      }
      try {
        setUser(await AuthService.me());
        setStatus("signedIn");
      } catch {
        // A refused token was already cleared by the 401 handler below; anything else (the API
        // dropped mid-request) should not throw away a session that is probably still good.
        setStatus(session.getToken() ? "unreachable" : "signedOut");
      }
    } finally {
      resolving.current = false;
    }
  }, []);

  useEffect(() => {
    void resolve();
  }, [resolve]);

  // Any request answered with 401: the session ended, or sign-in was switched on a moment ago by
  // creating the first administrator. Forget everything cached from the previous identity.
  useEffect(
    () =>
      onUnauthorized(() => {
        session.clear();
        setScopeState("");
        setUser(null);
        setStatus("signedOut");
        qc.clear();
      }),
    [qc],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await AuthService.login(email, password);
      qc.clear();
      session.setToken(res.token);
      session.setScope("");
      setScopeState("");
      setUser(res.user);
      setStatus("signedIn");
    },
    [qc],
  );

  const logout = useCallback(async () => {
    try {
      await AuthService.logout();
    } catch {
      /* the session is being dropped locally either way */
    }
    session.clear();
    setScopeState("");
    setUser(null);
    setStatus("signedOut");
    qc.clear();
  }, [qc]);

  const setScope = useCallback(
    (clientId: string) => {
      session.setScope(clientId);
      setScopeState(clientId);
      // Every list on screen was fetched for the previous scope.
      void qc.invalidateQueries();
    },
    [qc],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      isAdmin: status === "open" || user?.role === "admin",
      scope,
      setScope,
      login,
      logout,
      retry: () => {
        setStatus("loading");
        void resolve();
      },
    }),
    [status, user, scope, setScope, login, logout, resolve],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
