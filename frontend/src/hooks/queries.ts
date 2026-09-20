import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DeviceService } from "../services/DeviceService";
import { MediaService } from "../services/MediaService";
import { PlaylistService } from "../services/PlaylistService";
import { ScheduleService } from "../services/ScheduleService";
import { AppUpdateService } from "../services/AppUpdateService";
import { ClientService, HandoverService, UserService } from "../services/AccountService";
import type { HandoverRequest, UserCreatePayload, UserUpdatePayload } from "../types/account";
import { ReportService } from "../services/ReportService";
import type { PlayReportQuery } from "../types/report";
import type { DeviceCreatePayload, DeviceUpdatePayload } from "../types/device";
import type { MediaUpdatePayload } from "../types/media";
import type { PlaylistCreatePayload, PlaylistUpdatePayload } from "../types/playlist";
import type { ScheduleCreatePayload, ScheduleUpdatePayload } from "../types/schedule";
import type { AppUpdateUploadPayload } from "../types/appUpdate";

export const queryKeys = {
  devices: ["devices"] as const,
  media: ["media"] as const,
  playlists: ["playlists"] as const,
  schedules: ["schedules"] as const,
  appUpdates: ["app-updates"] as const,
  users: ["users"] as const,
  clients: ["clients"] as const,
};

// Devices report heartbeats every minute, so poll their list a little faster than the rest.
const DEVICE_POLL_MS = 15_000;
const LIST_POLL_MS = 60_000;

export function useDevices() {
  return useQuery({ queryKey: queryKeys.devices, queryFn: DeviceService.list, refetchInterval: DEVICE_POLL_MS });
}
export function useMedia() {
  return useQuery({ queryKey: queryKeys.media, queryFn: MediaService.list, refetchInterval: LIST_POLL_MS });
}
export function usePlaylists() {
  return useQuery({ queryKey: queryKeys.playlists, queryFn: PlaylistService.list, refetchInterval: LIST_POLL_MS });
}
export function useSchedules() {
  return useQuery({ queryKey: queryKeys.schedules, queryFn: ScheduleService.list, refetchInterval: LIST_POLL_MS });
}
/** Player releases are the operator's business; pass `false` for client users, who would only get a 403. */
export function useAppUpdates(enabled = true) {
  return useQuery({ queryKey: queryKeys.appUpdates, queryFn: AppUpdateService.list, enabled });
}

function useInvalidator(...keys: readonly (readonly string[])[]) {
  const qc = useQueryClient();
  return () => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: k })));
}

// ── Devices ────────────────────────────────────────────────────────────────
export function useCreateDevice() {
  const invalidate = useInvalidator(queryKeys.devices);
  return useMutation({ mutationFn: (d: DeviceCreatePayload) => DeviceService.create(d), onSuccess: invalidate });
}
export function useUpdateDevice() {
  // Handing a screen to a client changes that client's counts too.
  const invalidate = useInvalidator(queryKeys.devices, queryKeys.clients);
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DeviceUpdatePayload }) => DeviceService.update(id, data),
    onSuccess: invalidate,
  });
}
export function useDeleteDevices() {
  const invalidate = useInvalidator(queryKeys.devices, queryKeys.playlists, queryKeys.schedules);
  return useMutation({ mutationFn: (ids: string[]) => deleteMany(ids, DeviceService.remove), onSettled: invalidate });
}

// ── Media ──────────────────────────────────────────────────────────────────
export function useUpdateMedia() {
  const invalidate = useInvalidator(queryKeys.media);
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: MediaUpdatePayload }) => MediaService.update(id, data),
    onSuccess: invalidate,
  });
}
export function useDeleteMedia() {
  const invalidate = useInvalidator(queryKeys.media, queryKeys.playlists);
  return useMutation({ mutationFn: (ids: string[]) => deleteMany(ids, MediaService.remove), onSettled: invalidate });
}

// ── Playlists ──────────────────────────────────────────────────────────────
export function useCreatePlaylist() {
  const invalidate = useInvalidator(queryKeys.playlists);
  return useMutation({ mutationFn: (d: PlaylistCreatePayload) => PlaylistService.create(d), onSuccess: invalidate });
}
export function useUpdatePlaylist() {
  const invalidate = useInvalidator(queryKeys.playlists, queryKeys.devices);
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: PlaylistUpdatePayload }) => PlaylistService.update(id, data),
    onSuccess: invalidate,
  });
}
export function useDeletePlaylists() {
  const invalidate = useInvalidator(queryKeys.playlists, queryKeys.schedules);
  return useMutation({ mutationFn: (ids: string[]) => deleteMany(ids, PlaylistService.remove), onSettled: invalidate });
}

/**
 * Makes `playlistId` the directly-assigned playlist for the given devices (null clears the assignment).
 * The backend stores assignments per playlist, so the device must also be removed from every other playlist,
 * otherwise the player would pick whichever row happens to come first.
 */
export function useAssignPlaylistToDevices() {
  const qc = useQueryClient();
  const invalidate = useInvalidator(queryKeys.playlists, queryKeys.devices);
  return useMutation({
    mutationFn: async ({ playlistId, deviceIds }: { playlistId: string | null; deviceIds: string[] }) => {
      const playlists = await qc.fetchQuery({ queryKey: queryKeys.playlists, queryFn: PlaylistService.list, staleTime: 0 });
      const updates: Promise<unknown>[] = [];
      for (const p of playlists) {
        const has = p.assignedDeviceIds.some((d) => deviceIds.includes(d));
        if (p.id === playlistId) {
          const next = Array.from(new Set([...p.assignedDeviceIds, ...deviceIds]));
          if (next.length !== p.assignedDeviceIds.length) updates.push(PlaylistService.update(p.id, { assignedDeviceIds: next }));
        } else if (has) {
          updates.push(PlaylistService.update(p.id, { assignedDeviceIds: p.assignedDeviceIds.filter((d) => !deviceIds.includes(d)) }));
        }
      }
      await Promise.all(updates);
    },
    onSettled: invalidate,
  });
}

// ── Schedules ──────────────────────────────────────────────────────────────
export function useCreateSchedule() {
  const invalidate = useInvalidator(queryKeys.schedules);
  return useMutation({ mutationFn: (d: ScheduleCreatePayload) => ScheduleService.create(d), onSuccess: invalidate });
}
export function useUpdateSchedule() {
  const invalidate = useInvalidator(queryKeys.schedules);
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ScheduleUpdatePayload }) => ScheduleService.update(id, data),
    onSuccess: invalidate,
  });
}
export function useDeleteSchedules() {
  const invalidate = useInvalidator(queryKeys.schedules);
  return useMutation({ mutationFn: (ids: string[]) => deleteMany(ids, ScheduleService.remove), onSettled: invalidate });
}

// ── App updates (OTA) ──────────────────────────────────────────────────────
export function useUploadAppUpdate() {
  const invalidate = useInvalidator(queryKeys.appUpdates);
  return useMutation({
    mutationFn: ({ payload, onProgress }: { payload: AppUpdateUploadPayload; onProgress?: (f: number) => void }) =>
      AppUpdateService.upload(payload, onProgress).promise,
    onSuccess: invalidate,
  });
}
export function useToggleAppUpdate() {
  const invalidate = useInvalidator(queryKeys.appUpdates);
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => (active ? AppUpdateService.activate(id) : AppUpdateService.deactivate(id)),
    onSuccess: invalidate,
  });
}
export function useDeleteAppUpdate() {
  const invalidate = useInvalidator(queryKeys.appUpdates);
  return useMutation({ mutationFn: (id: string) => AppUpdateService.remove(id), onSuccess: invalidate });
}

// ── Accounts (administrators only) ─────────────────────────────────────────
export function useClients(enabled = true) {
  return useQuery({ queryKey: queryKeys.clients, queryFn: ClientService.list, enabled, staleTime: 60_000 });
}
export function useUsers() {
  return useQuery({ queryKey: queryKeys.users, queryFn: UserService.list });
}
export function useCreateUser() {
  const invalidate = useInvalidator(queryKeys.users, queryKeys.clients);
  return useMutation({ mutationFn: (d: UserCreatePayload) => UserService.create(d), onSuccess: invalidate });
}
export function useUpdateUser() {
  const invalidate = useInvalidator(queryKeys.users, queryKeys.clients);
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: UserUpdatePayload }) => UserService.update(id, data), onSuccess: invalidate });
}
export function useDeleteUser() {
  const invalidate = useInvalidator(queryKeys.users, queryKeys.clients);
  return useMutation({ mutationFn: (id: string) => UserService.remove(id), onSuccess: invalidate });
}
export function useCreateClient() {
  const invalidate = useInvalidator(queryKeys.clients);
  return useMutation({ mutationFn: (name: string) => ClientService.create(name), onSuccess: invalidate });
}
export function useRenameClient() {
  const invalidate = useInvalidator(queryKeys.clients, queryKeys.users);
  return useMutation({ mutationFn: ({ id, name }: { id: string; name: string }) => ClientService.update(id, name), onSuccess: invalidate });
}
export function useDeleteClient() {
  const invalidate = useInvalidator(queryKeys.clients);
  return useMutation({ mutationFn: (id: string) => ClientService.remove(id), onSuccess: invalidate });
}
/** What a handover would move and leave, without doing it. Never cached: ownership changes under it. */
export function useHandoverPreview(request: Omit<HandoverRequest, "dryRun"> | null) {
  return useQuery({
    queryKey: ["handover-preview", request],
    queryFn: () => HandoverService.run({ ...request!, dryRun: true }),
    enabled: request !== null,
    staleTime: 0,
    gcTime: 0,
  });
}
export function useHandover() {
  const invalidate = useInvalidator(queryKeys.devices, queryKeys.media, queryKeys.playlists, queryKeys.schedules, queryKeys.clients);
  return useMutation({ mutationFn: (d: Omit<HandoverRequest, "dryRun">) => HandoverService.run({ ...d, dryRun: false }), onSuccess: invalidate });
}
// ── Reports ────────────────────────────────────────────────────────────────
/** Proof of play. Screens deliver in batches every few minutes, so a slow refresh is plenty. */
export function usePlayReport(query: PlayReportQuery) {
  return useQuery({
    queryKey: ["reports", "plays", query],
    queryFn: () => ReportService.plays(query),
    refetchInterval: 5 * 60_000,
    placeholderData: (previous) => previous,
  });
}

// ── helpers ────────────────────────────────────────────────────────────────
export interface BulkResult {
  ok: string[];
  failed: { id: string; error: string }[];
}

async function deleteMany(ids: string[], fn: (id: string) => Promise<void>): Promise<BulkResult> {
  const results = await Promise.allSettled(ids.map((id) => fn(id)));
  const out: BulkResult = { ok: [], failed: [] };
  results.forEach((r, i) => {
    if (r.status === "fulfilled") out.ok.push(ids[i]);
    else out.failed.push({ id: ids[i], error: (r.reason as Error)?.message || "Failed" });
  });
  if (out.ok.length === 0 && out.failed.length > 0) throw new Error(out.failed[0].error);
  return out;
}
