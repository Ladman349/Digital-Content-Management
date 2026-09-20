import { API_BASE, api } from "../api/client";
import type { Client, HandoverRequest, HandoverResponse, LoginResponse, User, UserCreatePayload, UserUpdatePayload } from "../types/account";

export const AuthService = {
  /**
   * Whether the backend wants a sign-in at all. A backend from before accounts existed has no such
   * route and answers 404, which means the same thing as "no": run the CMS as it always ran.
   * Returns null when the API cannot be reached, so the caller can say so instead of guessing.
   */
  async loginRequired(): Promise<boolean | null> {
    try {
      const res = await fetch(`${API_BASE}/auth/status`, { cache: "no-store" });
      if (res.status === 404) return false;
      if (!res.ok) return null;
      return Boolean((await res.json())?.loginRequired);
    } catch {
      return null;
    }
  },
  login: (email: string, password: string) => api.post<LoginResponse>("/auth/login", { email, password }, { expect401: true }),
  logout: () => api.post<void>("/auth/logout"),
  me: () => api.get<User>("/auth/me"),
  changePassword: (currentPassword: string, newPassword: string) => api.post<void>("/auth/password", { currentPassword, newPassword }),
};

export const UserService = {
  list: () => api.get<User[]>("/users"),
  create: (data: UserCreatePayload) => api.post<User>("/users", data),
  update: (id: string, data: UserUpdatePayload) => api.put<User>(`/users/${encodeURIComponent(id)}`, data),
  remove: (id: string) => api.delete(`/users/${encodeURIComponent(id)}`),
};

export const ClientService = {
  list: () => api.get<Client[]>("/clients"),
  create: (name: string) => api.post<Client>("/clients", { name }),
  update: (id: string, name: string) => api.put<Client>(`/clients/${encodeURIComponent(id)}`, { name }),
  remove: (id: string) => api.delete(`/clients/${encodeURIComponent(id)}`),
};

export const HandoverService = {
  /** Moves screens to a client along with whatever only they play; `dryRun` previews it. */
  run: (data: HandoverRequest) => api.post<HandoverResponse>("/handover", data),
};
