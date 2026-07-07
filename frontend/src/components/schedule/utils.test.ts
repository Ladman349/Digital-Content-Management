import { test } from "node:test";
import assert from "node:assert";
import { findConflicts } from "./utils.ts";
import type { Schedule } from "./types.ts";

function createMockSchedule(
  id: string,
  startDate: string,
  endDate: string,
  startTime: string,
  endTime: string,
  deviceIds: string[] = ["DEV-1"],
  status: Schedule["status"] = "Active"
): Schedule {
  return {
    id,
    name: "Mock Schedule",
    playlistId: "PL-1",
    deviceIds,
    startDate,
    endDate,
    startTime,
    endTime,
    repeat: "Daily",
    priority: "Normal",
    status,
  };
}

test("findConflicts: overlapping dates + overlapping times = conflict", () => {
  const existing = createMockSchedule("S-1", "2026-06-22", "2026-07-12", "10:00", "19:00");
  const newSchedule = createMockSchedule("S-2", "2026-07-01", "2026-07-30", "12:00", "17:00");
  
  const conflicts = findConflicts([existing], newSchedule);
  assert.strictEqual(conflicts.length, 1);
  assert.strictEqual(conflicts[0].id, "S-1");
});

test("findConflicts: non-overlapping dates = no conflict", () => {
  const existing = createMockSchedule("S-1", "2026-06-22", "2026-07-12", "10:00", "19:00");
  const newSchedule = createMockSchedule("S-2", "2026-07-13", "2026-07-30", "09:00", "17:00");
  
  const conflicts = findConflicts([existing], newSchedule);
  assert.strictEqual(conflicts.length, 0);
});

test("findConflicts: overlapping dates + non-overlapping times = no conflict", () => {
  const existing = createMockSchedule("S-1", "2026-06-22", "2026-07-12", "10:00", "12:00");
  const newSchedule = createMockSchedule("S-2", "2026-07-01", "2026-07-30", "13:00", "17:00");
  
  const conflicts = findConflicts([existing], newSchedule);
  assert.strictEqual(conflicts.length, 0);
});

test("findConflicts: inactive schedules are ignored", () => {
  const existing = createMockSchedule("S-1", "2026-06-22", "2026-07-12", "10:00", "19:00", ["DEV-1"], "Paused");
  const newSchedule = createMockSchedule("S-2", "2026-07-01", "2026-07-30", "12:00", "17:00");
  
  const conflicts = findConflicts([existing], newSchedule);
  assert.strictEqual(conflicts.length, 0);
});

test("findConflicts: different devices = no conflict", () => {
  const existing = createMockSchedule("S-1", "2026-06-22", "2026-07-12", "10:00", "19:00", ["DEV-1"]);
  const newSchedule = createMockSchedule("S-2", "2026-07-01", "2026-07-30", "12:00", "17:00", ["DEV-2"]);
  
  const conflicts = findConflicts([existing], newSchedule);
  assert.strictEqual(conflicts.length, 0);
});
