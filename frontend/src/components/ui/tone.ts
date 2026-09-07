import type { DeviceStatus } from "../../types/device";

/** Semantic colour roles used by status dots, chips and KPI tiles. */
export type Tone = "success" | "warning" | "error" | "info" | "neutral" | "primary";

export function deviceTone(status: DeviceStatus): Tone {
  if (status === "Online") return "success";
  if (status === "Idle") return "warning";
  return "error";
}
