export interface ReportTotals {
  plays: number;
  completedPlays: number;
  durationMs: number;
  screens: number;
  mediaFiles: number;
  lastPlayedAt: number | null;
}

export interface ReportRow {
  id: string;
  name: string;
  /** Media type for media rows. */
  kind?: string | null;
  /** False once the screen, file or playlist itself has been deleted. */
  exists: boolean;
  plays: number;
  completedPlays: number;
  durationMs: number;
  lastPlayedAt: number;
}

export interface ReportDay {
  date: string;
  plays: number;
  durationMs: number;
}

export interface ReportHour {
  hour: number;
  plays: number;
  durationMs: number;
}

export interface PlayReport {
  dateFrom: string;
  dateTo: string;
  timezone: string;
  totals: ReportTotals;
  byDay: ReportDay[];
  byHour: ReportHour[];
  byMedia: ReportRow[];
  byDevice: ReportRow[];
  byPlaylist: ReportRow[];
}

export interface PlayReportQuery {
  dateFrom: string;
  dateTo: string;
  deviceId?: string;
  mediaId?: string;
}
