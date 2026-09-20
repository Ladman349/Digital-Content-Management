import { api } from "../api/client";
import type { ActivityEntity, ActivityPage } from "../types/activity";

export const ActivityService = {
  page: (options: { before?: number | null; entityType?: ActivityEntity | ""; limit?: number }) => {
    const params = new URLSearchParams({ limit: String(options.limit ?? 50) });
    if (options.before) params.set("before", String(options.before));
    if (options.entityType) params.set("entity_type", options.entityType);
    return api.get<ActivityPage>(`/activity?${params.toString()}`);
  },
};
