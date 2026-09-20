export type ActivityEntity = "screen" | "media" | "playlist" | "schedule" | "user" | "client" | "release" | "account";

export interface ActivityEvent {
  id: number;
  at: number;
  /** "user" (signed in), "key" (admin key) or "open" (before sign-in was switched on). */
  actorKind: string;
  actorUserId?: string | null;
  actorName: string;
  actorRole?: "admin" | "client" | null;
  action: string;
  entityType: ActivityEntity;
  entityId?: string | null;
  entityName?: string | null;
  clientId?: string | null;
  summary?: string | null;
}

export interface ActivityPage {
  events: ActivityEvent[];
  /** Pass as `before` for the next, older page; null when there is nothing older. */
  nextBefore: number | null;
}
