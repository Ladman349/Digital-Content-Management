import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DeviceService } from "../services/DeviceService";
import { MediaService } from "../services/MediaService";
import { PlaylistService } from "../services/PlaylistService";
import { ScheduleService } from "../services/ScheduleService";
import type { Device } from "../types/device";
import type { MediaItem } from "../types/media";
import type { Playlist } from "../types/playlist";
import type { Schedule } from "../types/schedule";

// ── Query Keys ──────────────────────────────────────────────────────────────
export const queryKeys = {
  devices: ["devices"] as const,
  device: (id: string) => ["devices", id] as const,
  media: ["media"] as const,
  playlists: ["playlists"] as const,
  playlist: (id: string) => ["playlists", id] as const,
  schedules: ["schedules"] as const,
  dashboard: ["dashboard"] as const,
};

// ── Devices Hooks ───────────────────────────────────────────────────────────
export function useDevices() {
  return useQuery({
    queryKey: queryKeys.devices,
    queryFn: () => DeviceService.getDevices(),
  });
}

export function useCreateDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Device, "id">) => DeviceService.createDevice(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.devices });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useUpdateDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Device> }) =>
      DeviceService.updateDevice(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.devices });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => DeviceService.deleteDevice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.devices });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

// ── Media Hooks ─────────────────────────────────────────────────────────────
export function useMedia() {
  return useQuery({
    queryKey: queryKeys.media,
    queryFn: () => MediaService.getMedia(),
  });
}

export function useUploadMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<MediaItem, "id">) => MediaService.uploadMedia(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.media });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteMedia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => MediaService.deleteMedia(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.media });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

// ── Playlists Hooks ─────────────────────────────────────────────────────────
export function usePlaylists() {
  return useQuery({
    queryKey: queryKeys.playlists,
    queryFn: () => PlaylistService.getPlaylists(),
  });
}

export function useCreatePlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Playlist, "id">) => PlaylistService.createPlaylist(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.playlists });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useUpdatePlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Playlist> }) =>
      PlaylistService.updatePlaylist(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.playlists });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeletePlaylist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => PlaylistService.deletePlaylist(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.playlists });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

// ── Schedules Hooks ─────────────────────────────────────────────────────────
export function useSchedules() {
  return useQuery({
    queryKey: queryKeys.schedules,
    queryFn: () => ScheduleService.getSchedules(),
  });
}

export function useCreateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<Schedule, "id">) => ScheduleService.createSchedule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Schedule> }) =>
      ScheduleService.updateSchedule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ScheduleService.deleteSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
