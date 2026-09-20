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

/** One place the user is signed in. `id` is a handle for signing it out, never the token. */
export interface UserSessionInfo {
  id: string;
  createdAt: number;
  lastUsedAt: number;
  expiresAt: number;
  userAgent?: string | null;
  current: boolean;
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

export type HandoverKind = "screen" | "playlist" | "media" | "schedule";

export interface HandoverRequest {
  deviceIds: string[];
  /** The client receiving the screens; null hands them back to the operator. */
  clientId: string | null;
  /** False moves the screens alone. */
  includeContent?: boolean;
  /** True reports what would happen and changes nothing. */
  dryRun?: boolean;
}

export interface HandoverItem {
  kind: HandoverKind;
  id: string;
  name: string;
}

export interface HandoverResponse {
  clientId: string | null;
  clientName: string | null;
  applied: boolean;
  moved: HandoverItem[];
  left: (HandoverItem & { reason: string })[];
}
