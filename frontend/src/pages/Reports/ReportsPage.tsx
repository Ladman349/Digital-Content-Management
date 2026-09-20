import { useMemo, useState } from "react";
import { Box, Button, Chip, LinearProgress, TextField, Typography } from "@mui/material";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import InsightsRoundedIcon from "@mui/icons-material/InsightsRounded";
import { useSnackbar } from "notistack";

import PageHeader from "../../components/ui/PageHeader";
import SegmentedFilter from "../../components/ui/SegmentedFilter";
import FilterSelect from "../../components/ui/FilterSelect";
import DataTable, { type Column } from "../../components/ui/DataTable";
import EmptyState from "../../components/ui/EmptyState";
import ErrorState from "../../components/ui/ErrorState";
import RowLead from "../../components/ui/RowLead";
import ColumnChart, { type ColumnDatum } from "./ColumnChart";
import { useDevices, useMedia, usePlayReport } from "../../hooks/queries";
import { ReportService } from "../../services/ReportService";
import type { PlayReportQuery, ReportRow } from "../../types/report";
import { APP_TIMEZONE, relativeTime } from "../../utils/format";
import { useNow } from "../../hooks/useNow";
import { useIsCompact } from "../../hooks/useIsPhone";
import { MONO } from "../../app/theme";

type RangeKey = "today" | "7d" | "30d" | "90d" | "custom";
type RankKey = "media" | "screens" | "playlists";

const RANGE_DAYS: Record<Exclude<RangeKey, "custom">, number> = { today: 1, "7d": 7, "30d": 30, "90d": 90 };
const NO_ROWS: ReportRow[] = [];

/** Reports run on the platform's clock, not the browser's, so "today" is worked out there too. */
function platformDate(at: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
}
function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function dayLabel(iso: string, style: "tick" | "full"): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", style === "tick" ? { timeZone: "UTC", day: "numeric", month: "short" } : { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(d);
}
function hourLabel(hour: number): string {
  const next = (hour + 1) % 24;
  return `${String(hour).padStart(2, "0")}:00 – ${String(next).padStart(2, "0")}:00`;
}
/** Time on screen reads in hours and minutes; the seconds only matter when there is little of it. */
function screenTime(ms: number): string {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h.toLocaleString("en-IN")}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s % 60).padStart(2, "0")}s`;
  return `${s}s`;
}
const number = (n: number) => n.toLocaleString("en-IN");

export default function ReportsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const now = useNow(60_000);
  const compact = useIsCompact();
  const today = platformDate(now);

  const [range, setRange] = useState<RangeKey>("7d");
  const [customFrom, setCustomFrom] = useState(() => shiftDate(platformDate(Date.now()), -6));
  const [customTo, setCustomTo] = useState(() => platformDate(Date.now()));
  const [deviceId, setDeviceId] = useState("");
  const [mediaId, setMediaId] = useState("");
  const [rank, setRank] = useState<RankKey>("media");
  const [exporting, setExporting] = useState(false);

  const query: PlayReportQuery = useMemo(() => {
    const dates = range === "custom" ? { dateFrom: customFrom <= customTo ? customFrom : customTo, dateTo: customTo } : { dateFrom: shiftDate(today, 1 - RANGE_DAYS[range]), dateTo: today };
    return { ...dates, deviceId: deviceId || undefined, mediaId: mediaId || undefined };
  }, [range, customFrom, customTo, today, deviceId, mediaId]);

  const { data: report, isLoading, isFetching, error, refetch } = usePlayReport(query);
  const { data: devices = [] } = useDevices();
  const { data: media = [] } = useMedia();

  // A filter stays selectable after its screen or file is deleted, as long as the report still names it.
  const deviceOptions = useMemo(() => {
    const names = new Map(devices.map((d) => [d.id, d.name]));
    report?.byDevice.forEach((r) => names.has(r.id) || names.set(r.id, r.name));
    return [{ value: "", label: "All screens" }, ...[...names].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))];
  }, [devices, report]);
  const mediaOptions = useMemo(() => {
    const names = new Map(media.map((m) => [m.id, m.name]));
    report?.byMedia.forEach((r) => names.has(r.id) || names.set(r.id, r.name));
    return [{ value: "", label: "All media" }, ...[...names].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label))];
  }, [media, report]);

  const dayData: ColumnDatum[] = useMemo(
    () => (report?.byDay ?? []).map((d) => ({ key: d.date, tick: dayLabel(d.date, "tick"), label: dayLabel(d.date, "full"), value: d.plays, detail: `${screenTime(d.durationMs)} on screen` })),
    [report],
  );
  const hourData: ColumnDatum[] = useMemo(
    () => (report?.byHour ?? []).map((h) => ({ key: String(h.hour), tick: String(h.hour).padStart(2, "0"), label: hourLabel(h.hour), value: h.plays, detail: `${screenTime(h.durationMs)} on screen` })),
    [report],
  );

  const rows = report ? { media: report.byMedia, screens: report.byDevice, playlists: report.byPlaylist }[rank] : NO_ROWS;
  const topPlays = Math.max(1, ...rows.map((r) => r.plays));
  const totals = report?.totals;

  const columns: Column<ReportRow>[] = [
    {
      key: "name",
      label: rank === "media" ? "File" : rank === "screens" ? "Screen" : "Playlist",
      lead: true,
      render: (r) => <RowLead name={r.name} sub={r.exists ? (r.kind ? `${r.kind} · ${r.id}` : r.id) : `Deleted · ${r.id}`} />,
    },
    {
      key: "plays",
      label: "Plays",
      onCard: true,
      width: "32%",
      render: (r) => (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
          <Typography sx={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, width: { xs: "auto", sm: 64 }, textAlign: { xs: "left", sm: "right" }, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{number(r.plays)}</Typography>
          <Box sx={{ flex: 1, height: 6, minWidth: 24, display: { xs: "none", sm: "block" } }}>
            <Box sx={{ width: `${(r.plays / topPlays) * 100}%`, minWidth: 2, height: "100%", borderRadius: "0 3px 3px 0", bgcolor: (t) => (t.palette.mode === "dark" ? t.palette.board.amber : t.palette.primary.main) }} />
          </Box>
        </Box>
      ),
    },
    { key: "share", label: "Share", width: 80, align: "right", hideBelow: "md", render: (r) => <Mono>{totals && totals.plays > 0 ? `${((r.plays / totals.plays) * 100).toFixed(1)}%` : "—"}</Mono> },
    { key: "time", label: "On screen", onCard: true, width: 110, align: "right", render: (r) => <Mono>{screenTime(r.durationMs)}</Mono> },
    { key: "complete", label: "Played in full", width: 120, align: "right", hideBelow: "md", render: (r) => <Mono>{r.plays > 0 ? `${Math.round((r.completedPlays / r.plays) * 100)}%` : "—"}</Mono> },
    { key: "last", label: "Last played", width: 120, align: "right", hideBelow: "sm", render: (r) => <Mono>{relativeTime(r.lastPlayedAt, now)}</Mono> },
  ];

  const exportCsv = async () => {
    setExporting(true);
    try {
      await ReportService.exportCsv(query);
    } catch (e) {
      enqueueSnackbar((e as Error).message, { variant: "error" });
    } finally {
      setExporting(false);
    }
  };

  const filtered = Boolean(deviceId || mediaId);
  const empty = !isLoading && !error && totals?.plays === 0;

  return (
    <Box>
      <PageHeader
        title="Reports"
        filters={
          <>
            <SegmentedFilter
              ariaLabel="Period"
              value={range}
              onChange={setRange}
              options={[
                { value: "today", label: "Today" },
                { value: "7d", label: "7 days" },
                { value: "30d", label: "30 days" },
                { value: "90d", label: "90 days" },
                { value: "custom", label: "Custom" },
              ]}
            />
            {range === "custom" && (
              <>
                <TextField type="date" label="From" value={customFrom} onChange={(e) => e.target.value && setCustomFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: customTo } }} sx={{ width: 150, flexShrink: 0 }} />
                <TextField type="date" label="To" value={customTo} onChange={(e) => e.target.value && setCustomTo(e.target.value)} slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: customFrom, max: today } }} sx={{ width: 150, flexShrink: 0 }} />
              </>
            )}
            <FilterSelect label="Screen" value={deviceId} onChange={setDeviceId} options={deviceOptions} width={170} />
            <FilterSelect label="Media" value={mediaId} onChange={setMediaId} options={mediaOptions} width={170} />
          </>
        }
        count={report ? `${dayLabel(report.dateFrom, "tick")} – ${dayLabel(report.dateTo, "tick")}` : undefined}
        meta="Indian time"
        actions={
          <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />} onClick={exportCsv} disabled={exporting || !totals || totals.plays === 0}>
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        }
      />

      <Box sx={{ height: 2, mb: 1 }}>{isFetching && <LinearProgress sx={{ height: 2 }} />}</Box>

      {error ? (
        <ErrorState noun="reports" message={(error as Error).message} onRetry={() => refetch()} />
      ) : empty && !filtered ? (
        <EmptyState
          icon={InsightsRoundedIcon}
          title="No plays reported in this period"
          description="Screens report what they showed every few minutes, and catch up after being offline. Reporting starts with player 1.3.0: publish it on the Updates page and each screen begins counting as soon as it has updated."
        />
      ) : (
        <Box sx={{ display: "grid", gap: "1px", bgcolor: "board.grid" }}>
          {/* The one number the page leads with, and what qualifies it. */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(3, minmax(0, 1fr))", md: "1.4fr 1fr 1fr 1fr" }, gap: "1px" }}>
            <Tile label="Plays" value={totals ? number(totals.plays) : "—"} hero sub={totals?.lastPlayedAt ? `Last one ${relativeTime(totals.lastPlayedAt, now)}` : undefined} />
            <Tile label="Time on screen" value={totals ? screenTime(totals.durationMs) : "—"} />
            <Tile label="Screens" value={totals ? number(totals.screens) : "—"} />
            <Tile label="Files" value={totals ? number(totals.mediaFiles) : "—"} />
          </Box>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1.5fr) minmax(0, 1fr)" }, gap: "1px" }}>
            <Panel title="Plays per day">
              <ColumnChart data={dayData} unit="plays" tickEvery={Math.max(1, Math.ceil(dayData.length / (compact ? 4 : 8)))} currentKey={today} />
            </Panel>
            <Panel title="Plays by hour of day" note="Every day in the period, added together">
              <ColumnChart data={hourData} unit="plays" tickEvery={compact ? 6 : 3} />
            </Panel>
          </Box>

          <Box sx={{ bgcolor: "board.cell", p: { xs: 1.5, md: 2 } }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1.5, flexWrap: "wrap", mb: 1.5 }}>
              <SegmentedFilter
                ariaLabel="Rank by"
                value={rank}
                onChange={setRank}
                options={[
                  { value: "media", label: "Media", count: report?.byMedia.length },
                  { value: "screens", label: "Screens", count: report?.byDevice.length },
                  { value: "playlists", label: "Playlists", count: report?.byPlaylist.length },
                ]}
              />
              <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                {deviceId && <Chip size="small" label={`Screen: ${deviceOptions.find((o) => o.value === deviceId)?.label ?? deviceId}`} onDelete={() => setDeviceId("")} />}
                {mediaId && <Chip size="small" label={`Media: ${mediaOptions.find((o) => o.value === mediaId)?.label ?? mediaId}`} onDelete={() => setMediaId("")} />}
              </Box>
            </Box>
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(r) => r.id}
              loading={isLoading}
              noun={rank}
              // A row is a question: "and where did this one play?" Clicking it narrows the whole page.
              onRowClick={rank === "media" ? (r) => setMediaId(r.id === mediaId ? "" : r.id) : rank === "screens" ? (r) => setDeviceId(r.id === deviceId ? "" : r.id) : undefined}
              activeRowKey={rank === "media" ? mediaId || null : rank === "screens" ? deviceId || null : null}
              rowDim={(r) => !r.exists}
              pageSize={25}
              emptyState={<EmptyState icon={InsightsRoundedIcon} title="Nothing played" description="No plays match this period and these filters." compact />}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return <Typography sx={{ fontFamily: MONO, fontSize: 11.5, fontVariantNumeric: "tabular-nums", color: "text.secondary" }}>{children}</Typography>;
}

function Tile({ label, value, sub, hero }: { label: string; value: string; sub?: string; hero?: boolean }) {
  return (
    <Box sx={{ bgcolor: "board.cell", p: { xs: 1.5, md: 2 }, minWidth: 0, gridColumn: { xs: hero ? "1 / -1" : "auto", md: "auto" } }}>
      <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: "text.secondary" }}>{label}</Typography>
      <Typography sx={{ fontSize: hero ? { xs: 44, md: 56 } : { xs: 24, md: 30 }, fontWeight: 700, lineHeight: 1.1, mt: 0.75, letterSpacing: "-0.02em", overflowWrap: "anywhere" }}>{value}</Typography>
      {sub && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
          {sub}
        </Typography>
      )}
    </Box>
  );
}

function Panel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <Box sx={{ bgcolor: "board.cell", p: { xs: 1.5, md: 2 }, minWidth: 0 }}>
      <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1, mb: 2.5, flexWrap: "wrap" }}>
        <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: "text.secondary" }}>{title}</Typography>
        {note && (
          <Typography variant="caption" color="text.secondary">
            {note}
          </Typography>
        )}
      </Box>
      {children}
    </Box>
  );
}
