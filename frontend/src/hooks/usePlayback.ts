import { useMemo } from "react";
import type { Device } from "../types/device";
import type { Playlist } from "../types/playlist";
import type { Schedule } from "../types/schedule";
import { isScheduleLiveNow, PRIORITY_WEIGHT } from "../utils/schedule";

export interface DevicePlayback {
  /** Playlist the backend will serve right now (schedule wins over direct assignment). */
  effective: Playlist | null;
  /** Live schedule driving playback, if any. */
  liveSchedule: Schedule | null;
  /** Playlist directly assigned to the device (fallback when no schedule is live). */
  assigned: Playlist | null;
  /** Playlist the device last reported it was playing. */
  reported: Playlist | null;
  /** True when the device reports something other than what it should be playing. */
  mismatch: boolean;
}

/**
 * Mirrors the backend's PlayerService resolution so the CMS can show what each screen should be playing:
 * highest-priority live Active schedule → directly assigned playlist → nothing.
 */
export function usePlaybackMap(devices: Device[], playlists: Playlist[], schedules: Schedule[], now: number): Map<string, DevicePlayback> {
  return useMemo(() => {
    const byId = new Map(playlists.map((p) => [p.id, p]));
    const date = new Date(now);
    const live = schedules.filter((s) => isScheduleLiveNow(s, date)).sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);
    const map = new Map<string, DevicePlayback>();
    for (const d of devices) {
      const liveSchedule = live.find((s) => s.deviceIds.includes(d.id)) ?? null;
      const assigned = playlists.find((p) => p.assignedDeviceIds.includes(d.id)) ?? null;
      const effective = liveSchedule ? (byId.get(liveSchedule.playlistId) ?? null) : assigned;
      const reported = d.currentPlaylistId ? (byId.get(d.currentPlaylistId) ?? null) : null;
      const mismatch = d.status !== "Offline" && Boolean(effective) && reported?.id !== effective?.id;
      map.set(d.id, { effective, liveSchedule, assigned, reported, mismatch });
    }
    return map;
  }, [devices, playlists, schedules, now]);
}
