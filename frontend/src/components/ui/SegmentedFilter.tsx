import { Box, ButtonBase, alpha } from "@mui/material";

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

/** Row of pill toggles with optional counts; used for status filters so every bucket is visible at a glance. */
export default function SegmentedFilter<T extends string>({ options, value, onChange, ariaLabel }: Props<T>) {
  return (
    <Box
      role="tablist"
      aria-label={ariaLabel}
      sx={{ display: "inline-flex", p: 0.375, gap: 0.25, bgcolor: "surface.hover", borderRadius: 1.5, border: 1, borderColor: "surface.border", flexWrap: "wrap" }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <ButtonBase
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            sx={{
              px: 1.25,
              py: 0.5,
              borderRadius: 1,
              fontSize: 12.5,
              fontWeight: 600,
              color: active ? "text.primary" : "text.secondary",
              bgcolor: active ? "background.paper" : "transparent",
              boxShadow: active ? `0 1px 2px ${alpha("#000", 0.12)}` : "none",
              transition: "background-color .15s",
              "&:hover": { color: "text.primary" },
              gap: 0.75,
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            {o.label}
            {o.count !== undefined && (
              <Box component="span" sx={{ fontSize: 11, fontWeight: 600, color: active ? "primary.main" : "text.disabled", fontVariantNumeric: "tabular-nums" }}>
                {o.count}
              </Box>
            )}
          </ButtonBase>
        );
      })}
    </Box>
  );
}
