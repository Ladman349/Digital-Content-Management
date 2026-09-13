import { useMediaQuery, useTheme } from "@mui/material";

/** Below `sm`: the board becomes cards, editors go full screen, the bench becomes a sheet. */
export function useIsPhone(): boolean {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down("sm"));
}

/** Below `md`: toolbars stack and the tab strip gets its own row. */
export function useIsCompact(): boolean {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down("md"));
}
