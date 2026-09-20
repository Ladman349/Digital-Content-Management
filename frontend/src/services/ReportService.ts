import { api, download } from "../api/client";
import type { PlayReport, PlayReportQuery } from "../types/report";

function queryString(q: PlayReportQuery): string {
  const params = new URLSearchParams({ date_from: q.dateFrom, date_to: q.dateTo });
  if (q.deviceId) params.set("device_id", q.deviceId);
  if (q.mediaId) params.set("media_id", q.mediaId);
  return params.toString();
}

export const ReportService = {
  plays: (q: PlayReportQuery) => api.get<PlayReport>(`/reports/plays?${queryString(q)}`),
  /** Saves the same report as a spreadsheet file. */
  exportCsv: (q: PlayReportQuery) => download(`/reports/plays.csv?${queryString(q)}`, `proof-of-play_${q.dateFrom}_${q.dateTo}.csv`),
};
