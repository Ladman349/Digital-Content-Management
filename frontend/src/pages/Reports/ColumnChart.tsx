import { Box, Tooltip, Typography, useTheme } from "@mui/material";
import { MONO } from "../../app/theme";

export interface ColumnDatum {
  key: string;
  /** Under the axis. Only some are drawn; see `tickEvery`. */
  tick: string;
  /** Spoken and shown on hover: "Mon 14 Sep". */
  label: string;
  value: number;
  /** Second line of the tooltip: "1h 20m on screen". */
  detail?: string;
}

interface Props {
  data: ColumnDatum[];
  /** What the values are, for the tooltip and screen readers: "plays". */
  unit: string;
  height?: number;
  /** Draw every nth tick label so they never collide. */
  tickEvery?: number;
  /** The column that is still filling up (today): its tick is emphasised, since its bar is expected to be short. */
  currentKey?: string;
}

/** Rounds a maximum up to a number a person would put on an axis: 1, 2, 5 × a power of ten. */
function niceMax(max: number): number {
  if (max <= 4) return 4;
  const power = Math.pow(10, Math.floor(Math.log10(max)));
  const lead = max / power;
  const step = lead <= 1 ? 1 : lead <= 2 ? 2 : lead <= 4 ? 4 : lead <= 5 ? 5 : lead <= 8 ? 8 : 10;
  return step * power;
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/**
 * One series, one axis, thin columns on a hairline grid. Built from plain boxes rather than a chart
 * library: the whole of it is a row of bars, and this keeps it on the board's own type and colours.
 * Each column's hover target is its full-height slot, not just the bar, so short bars are reachable.
 */
export default function ColumnChart({ data, unit, height = 168, tickEvery = 1, currentKey }: Props) {
  const theme = useTheme();
  // True amber is the board's "playing" colour but washes out on white, where the deepened tone is used.
  const fill = theme.palette.mode === "dark" ? theme.palette.board.amber : theme.palette.primary.main;
  const top = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const gridValues = [top, top / 2, 0];

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "auto minmax(0, 1fr)", columnGap: 1 }}>
      {/* y axis */}
      <Box sx={{ height, display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-end" }}>
        {gridValues.map((v, i) => (
          // Each label is centred on its gridline: the first sits on the top edge, the last on the baseline.
          <Typography key={v} sx={{ fontFamily: MONO, fontSize: 10, lineHeight: 1, color: "text.secondary", transform: i === 0 ? "translateY(-50%)" : i === gridValues.length - 1 ? "translateY(50%)" : "none" }}>
            {compact.format(v)}
          </Typography>
        ))}
      </Box>

      {/* plot */}
      <Box sx={{ position: "relative", height }}>
        {gridValues.map((v, i) => (
          <Box key={v} sx={{ position: "absolute", left: 0, right: 0, top: `${(i / (gridValues.length - 1)) * 100}%`, borderTop: 1, borderColor: i === gridValues.length - 1 ? "surface.borderStrong" : "surface.border" }} />
        ))}
        <Box role="list" aria-label={`${unit} chart`} sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "stretch" }}>
          {data.map((d) => (
            <Tooltip
              key={d.key}
              arrow
              placement="top"
              title={
                <Box sx={{ textAlign: "center" }}>
                  <Box sx={{ fontWeight: 700 }}>
                    {d.value.toLocaleString("en-IN")} {unit}
                  </Box>
                  <Box sx={{ opacity: 0.8 }}>{d.label}</Box>
                  {d.detail && <Box sx={{ opacity: 0.8 }}>{d.detail}</Box>}
                </Box>
              }
            >
              <Box
                role="listitem"
                tabIndex={0}
                aria-label={`${d.label}: ${d.value.toLocaleString("en-IN")} ${unit}`}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  px: "1px",
                  outline: "none",
                  "&:hover, &:focus-visible": { bgcolor: "action.hover" },
                }}
              >
                <Box
                  sx={{
                    width: "100%",
                    maxWidth: 24,
                    height: `${(d.value / top) * 100}%`,
                    minHeight: d.value > 0 ? 2 : 0,
                    bgcolor: fill,
                    borderRadius: "4px 4px 0 0",
                    transition: "height 240ms ease",
                  }}
                />
              </Box>
            </Tooltip>
          ))}
        </Box>
      </Box>

      {/* x axis */}
      <Box />
      <Box sx={{ display: "flex", mt: 0.75 }}>
        {data.map((d, i) => (
          <Box key={d.key} sx={{ flex: 1, minWidth: 0, textAlign: "center", overflow: "visible" }}>
            {(i % tickEvery === 0 || i === data.length - 1) && (i === data.length - 1 || data.length - 1 - i >= tickEvery / 2) && (
              <Typography sx={{ fontFamily: MONO, fontSize: 10, lineHeight: 1, color: d.key === currentKey ? "text.primary" : "text.secondary", whiteSpace: "nowrap" }}>{d.tick}</Typography>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
