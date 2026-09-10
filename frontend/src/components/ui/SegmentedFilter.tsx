import { Box, ButtonBase } from "@mui/material";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface Props<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
}

/** Square filter chips carrying their own counts, so every bucket is legible without opening a menu. */
export default function SegmentedFilter<T extends string>({ options, value, onChange, ariaLabel }: Props<T>) {
  return (
    <Box role="tablist" aria-label={ariaLabel} sx={{ display: "inline-flex", gap: 0.5, flexWrap: "wrap" }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <ButtonBase
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            sx={(t) => ({
              px: 1.25,
              py: 0.65,
              gap: 0.75,
              borderRadius: 0.5,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.11em",
              textTransform: "uppercase",
              border: 1,
              borderColor: active ? t.palette.surface.borderStrong : "transparent",
              bgcolor: active ? t.palette.board.cell : "transparent",
              color: active ? "text.primary" : "text.secondary",
              display: "inline-flex",
              alignItems: "center",
              "&:hover": { color: "text.primary", borderColor: t.palette.surface.border },
            })}
          >
            {o.label}
            {o.count !== undefined && (
              <Box component="span" sx={{ fontFamily: (t) => t.typography.caption.fontFamily, fontSize: 10.5, color: active ? "primary.main" : "text.disabled", fontVariantNumeric: "tabular-nums" }}>
                {o.count}
              </Box>
            )}
          </ButtonBase>
        );
      })}
    </Box>
  );
}
