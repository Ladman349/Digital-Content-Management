export type UserRole = "admin" | "client";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  clientId?: string | null;
  clientName?: string | null;
  isActive: boolean;
  createdAt: number;
  lastLoginAt?: number | null;
}

export interface LoginResponse {
  token: string;
  expiresAt: number;
  user: User;
}

export interface UserCreatePayload {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  clientId?: string | null;
}

export interface UserUpdatePayload {
  name?: string;
  role?: UserRole;
  clientId?: string | null;
  isActive?: boolean;
  /** Resets the password and signs the user out everywhere. */
  password?: string;
}

export interface Client {
  id: string;
  name: string;
  createdAt: number;
  userCount: number;
  deviceCount: number;
  mediaCount: number;
  playlistCount: number;
  scheduleCount: number;
}

export const PASSWORD_MIN_LENGTH = 8;
