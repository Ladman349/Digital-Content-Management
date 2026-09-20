import { useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { Box, Button, LinearProgress, Tooltip, Typography } from "@mui/material";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import { useInfiniteQuery } from "@tanstack/react-query";

import PageHeader from "../../components/ui/PageHeader";
import SegmentedFilter, { type SegmentOption } from "../../components/ui/SegmentedFilter";
import EmptyState from "../../components/ui/EmptyState";
import ErrorState from "../../components/ui/ErrorState";
import { useAuth } from "../../auth/AuthProvider";
import { ActivityService } from "../../services/ActivityService";
import type { ActivityEntity, ActivityEvent } from "../../types/activity";
import { APP_TIMEZONE, formatDateTime, relativeTime } from "../../utils/format";
import { useNow } from "../../hooks/useNow";
import { MONO } from "../../app/theme";

type Filter = "" | ActivityEntity;

const VERBS: Record<string, string> = {
  created: "created",
  updated: "changed",
  deleted: "deleted",
  uploaded: "uploaded",
  handed_over: "handed over",
  activated: "activated",
  deactivated: "deactivated",
  signed_in: "signed in",
  changed_password: "changed their password",
  signed_out_elsewhere: "signed out their other devices",
};
const NOUNS: Record<ActivityEntity, string> = { screen: "screen", media: "file", playlist: "playlist", schedule: "schedule", user: "user", client: "client", release: "player release", account: "" };
/** Where a row that still exists can be opened. */
const LINKS: Partial<Record<ActivityEntity, string>> = { screen: "/devices", media: "/media", playlist: "/playlists", schedule: "/schedule" };

function dayKey(at: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE }).format(new Date(at));
}
function dayHeading(key: string, today: string): string {
  if (key === today) return "Today";
  const d = new Date(`${key}T00:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(d);
}
function clock(at: number): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(at));
}

/**
 * Who changed what, newest first, grouped by day. A client sees what happened to their own screens
 * and content, whoever did it; account and player-release entries are the administrator's alone.
 */
export default function ActivityPage() {
  const { isAdmin } = useAuth();
  const now = useNow(60_000);
  const [filter, setFilter] = useState<Filter>("");

  const { data, isLoading, isFetching, isFetchingNextPage, hasNextPage, fetchNextPage, error, refetch } = useInfiniteQuery({
    queryKey: ["activity", filter],
    queryFn: ({ pageParam }) => ActivityService.page({ before: pageParam, entityType: filter }),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.nextBefore,
    refetchInterval: 60_000,
  });

  const events = useMemo(() => data?.pages.flatMap((p) => p.events) ?? [], [data]);
  const days = useMemo(() => {
    const groups: { key: string; events: ActivityEvent[] }[] = [];
    for (const e of events) {
      const key = dayKey(e.at);
      if (groups[groups.length - 1]?.key !== key) groups.push({ key, events: [] });
      groups[groups.length - 1].events.push(e);
    }
    return groups;
  }, [events]);
  const today = dayKey(now);

  const options: SegmentOption<Filter>[] = [
    { value: "", label: "Everything" },
    { value: "screen", label: "Screens" },
    { value: "media", label: "Media" },
    { value: "playlist", label: "Playlists" },
    { value: "schedule", label: "Schedules" },
    { value: "account", label: "Sign-ins" },
    ...(isAdmin ? ([{ value: "user", label: "Users" }, { value: "client", label: "Clients" }, { value: "release", label: "Releases" }] as SegmentOption<Filter>[]) : []),
  ];

  return (
    <Box>
      <PageHeader title="Activity" filters={<SegmentedFilter ariaLabel="Kind of activity" value={filter} onChange={setFilter} options={options} />} meta="Indian time · kept for 400 days" />
      <Box sx={{ height: 2, mb: 1 }}>{isFetching && !isFetchingNextPage && <LinearProgress sx={{ height: 2 }} />}</Box>

      {error ? (
        <ErrorState noun="activity" message={(error as Error).message} onRetry={() => refetch()} />
      ) : !isLoading && events.length === 0 ? (
        <EmptyState icon={HistoryRoundedIcon} title="Nothing recorded yet" description="Every change made in the CMS or the phone apps from now on appears here: who made it, to what, and when." />
      ) : (
        <Box sx={{ display: "grid", gap: 2.5 }}>
          {days.map((day) => (
            <Box key={day.key} component="section" aria-label={dayHeading(day.key, today)}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.13em", textTransform: "uppercase", color: "text.secondary", mb: 1 }}>
                {dayHeading(day.key, today)} · {day.events.length}
                {hasNextPage && day === days[days.length - 1] ? "+" : ""}
              </Typography>
              <Box sx={{ display: "grid", gap: "1px", bgcolor: "board.grid" }}>
                {day.events.map((e) => (
                  <Row key={e.id} event={e} now={now} />
                ))}
              </Box>
            </Box>
          ))}
          {hasNextPage && (
            <Button variant="outlined" onClick={() => fetchNextPage()} disabled={isFetchingNextPage} sx={{ justifySelf: "center" }}>
              {isFetchingNextPage ? "Loading…" : "Show older"}
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
}

function Row({ event: e, now }: { event: ActivityEvent; now: number }) {
  const verb = VERBS[e.action] ?? e.action.replace(/_/g, " ");
  const noun = NOUNS[e.entityType] ?? e.entityType;
  const link = e.action !== "deleted" && e.entityId ? LINKS[e.entityType] : undefined;
  const name = e.entityName || e.entityId;
  const about = e.entityType === "account";

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "48px minmax(0, 1fr)", md: "56px 190px minmax(0, 1fr)" }, columnGap: { xs: 1.25, md: 2 }, alignItems: "baseline", bgcolor: "board.cell", px: { xs: 1.5, md: 1.75 }, py: 1.1 }}>
      <Tooltip title={`${formatDateTime(e.at)} · ${relativeTime(e.at, now)}`} placement="top-start">
        <Typography sx={{ fontFamily: MONO, fontSize: 11.5, color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>{clock(e.at)}</Typography>
      </Tooltip>

      <Box sx={{ minWidth: 0, gridColumn: { xs: "2", md: "auto" } }}>
        <Typography sx={{ fontSize: 12.5, fontWeight: 600 }} noWrap title={e.actorName}>
          {e.actorName}
        </Typography>
        {e.actorKind === "user" && (
          <Typography sx={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: e.actorRole === "admin" ? "primary.main" : "text.secondary", display: { xs: "none", md: "block" } }}>
            {e.actorRole === "admin" ? "Administrator" : "Client user"}
          </Typography>
        )}
      </Box>

      <Box sx={{ minWidth: 0, gridColumn: { xs: "2", md: "auto" } }}>
        <Typography component="div" sx={{ fontSize: 13, overflowWrap: "anywhere" }}>
          <Box component="span" sx={{ color: "text.secondary" }}>
            {verb}
            {!about && noun ? ` ${noun} ` : " "}
          </Box>
          {!about &&
            (link ? (
              <Box component={RouterLink} to={`${link}?select=${encodeURIComponent(e.entityId!)}`} sx={{ fontWeight: 600, color: "text.primary", textDecorationColor: "currentcolor", textUnderlineOffset: "3px" }}>
                {name}
              </Box>
            ) : (
              <Box component="span" sx={{ fontWeight: 600 }}>
                {name}
              </Box>
            ))}
        </Typography>
        {e.summary && <Typography sx={{ fontFamily: MONO, fontSize: 11, color: "text.secondary", mt: 0.25, overflowWrap: "anywhere" }}>{e.summary}</Typography>}
      </Box>
    </Box>
  );
}
