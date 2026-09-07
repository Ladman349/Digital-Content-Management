import { alpha, createTheme } from "@mui/material/styles";
import type { PaletteMode } from "@mui/material";

const light = {
  bg: "#F5F6F8",
  paper: "#FFFFFF",
  border: "#E4E7EC",
  borderStrong: "#D0D5DD",
  text: "#101828",
  textSecondary: "#667085",
  hover: "#F2F4F7",
  subtle: "#F9FAFB",
};

const dark = {
  bg: "#0E1116",
  paper: "#161A22",
  border: "#262C38",
  borderStrong: "#344054",
  text: "#F2F4F7",
  textSecondary: "#98A2B3",
  hover: "#1D2330",
  subtle: "#11151C",
};

declare module "@mui/material/styles" {
  interface Palette {
    surface: { border: string; borderStrong: string; hover: string; subtle: string };
  }
  interface PaletteOptions {
    surface?: { border: string; borderStrong: string; hover: string; subtle: string };
  }
}

export function buildTheme(mode: PaletteMode) {
  const t = mode === "light" ? light : dark;
  const primary = mode === "light" ? "#4F46E5" : "#818CF8";
  return createTheme({
    palette: {
      mode,
      primary: { main: primary, contrastText: "#FFFFFF" },
      success: { main: mode === "light" ? "#16A34A" : "#4ADE80" },
      warning: { main: mode === "light" ? "#D97706" : "#FBBF24" },
      error: { main: mode === "light" ? "#DC2626" : "#F87171" },
      info: { main: mode === "light" ? "#0284C7" : "#38BDF8" },
      background: { default: t.bg, paper: t.paper },
      text: { primary: t.text, secondary: t.textSecondary },
      divider: t.border,
      surface: { border: t.border, borderStrong: t.borderStrong, hover: t.hover, subtle: t.subtle },
    },
    shape: { borderRadius: 8 },
    typography: {
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSize: 13.5,
      h1: { fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" },
      h2: { fontSize: 18, fontWeight: 700, letterSpacing: "-0.015em" },
      h3: { fontSize: 15, fontWeight: 600 },
      subtitle1: { fontSize: 14, fontWeight: 600 },
      subtitle2: { fontSize: 11.5, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" },
      body1: { fontSize: 13.5 },
      body2: { fontSize: 12.5 },
      caption: { fontSize: 11.5 },
      button: { textTransform: "none", fontWeight: 600, fontSize: 13 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: t.bg, color: t.text, WebkitFontSmoothing: "antialiased" },
          "*::-webkit-scrollbar": { width: 10, height: 10 },
          "*::-webkit-scrollbar-thumb": {
            backgroundColor: alpha(t.textSecondary, 0.35),
            borderRadius: 8,
            border: "2px solid transparent",
            backgroundClip: "padding-box",
          },
          "*::-webkit-scrollbar-track": { background: "transparent" },
        },
      },
      MuiButton: {
        defaultProps: { size: "small", disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 6, padding: "5px 12px", minHeight: 32 },
          outlined: { borderColor: t.borderStrong, color: t.text, "&:hover": { backgroundColor: t.hover, borderColor: t.borderStrong } },
        },
      },
      MuiIconButton: { defaultProps: { size: "small" }, styleOverrides: { root: { borderRadius: 6 } } },
      MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: "none" } } },
      MuiChip: {
        defaultProps: { size: "small" },
        styleOverrides: { root: { fontWeight: 600, borderRadius: 6, height: 22, fontSize: 11.5 }, label: { paddingLeft: 8, paddingRight: 8 } },
      },
      MuiTextField: { defaultProps: { size: "small" } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            backgroundColor: t.paper,
            fontSize: 13.5,
            "& .MuiOutlinedInput-notchedOutline": { borderColor: t.borderStrong },
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: alpha(primary, 0.6) },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: primary, borderWidth: 1.5 },
          },
          input: { padding: "7px 10px" },
        },
      },
      MuiInputLabel: { styleOverrides: { root: { fontSize: 13.5 } } },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottom: `1px solid ${t.border}`, padding: "7px 12px", fontSize: 13 },
          head: {
            fontWeight: 600,
            fontSize: 11.5,
            letterSpacing: "0.03em",
            textTransform: "uppercase",
            color: t.textSecondary,
            backgroundColor: t.subtle,
            whiteSpace: "nowrap",
          },
        },
      },
      MuiTableRow: { styleOverrides: { root: { "&:last-child td": { borderBottom: 0 } } } },
      MuiTooltip: { defaultProps: { arrow: true, enterDelay: 400 }, styleOverrides: { tooltip: { fontSize: 12, borderRadius: 6, padding: "5px 9px" } } },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: 10, border: `1px solid ${t.border}`, boxShadow: "0 24px 60px -12px rgba(0,0,0,0.35)", backgroundImage: "none" } },
      },
      MuiDialogTitle: { styleOverrides: { root: { fontSize: 16, fontWeight: 700, padding: "16px 20px 8px" } } },
      MuiDialogContent: { styleOverrides: { root: { padding: "8px 20px 16px" } } },
      MuiDialogActions: { styleOverrides: { root: { padding: "8px 20px 16px" } } },
      MuiMenu: { styleOverrides: { paper: { border: `1px solid ${t.border}`, boxShadow: "0 12px 32px -8px rgba(0,0,0,0.25)", borderRadius: 8 } } },
      MuiMenuItem: { styleOverrides: { root: { fontSize: 13, minHeight: 34, borderRadius: 4, margin: "0 4px" } } },
      MuiListItemIcon: { styleOverrides: { root: { minWidth: 30 } } },
      MuiTab: { styleOverrides: { root: { textTransform: "none", fontWeight: 600, fontSize: 13, minHeight: 38, padding: "6px 12px" } } },
      MuiTabs: { styleOverrides: { root: { minHeight: 38 } } },
      MuiLinearProgress: { styleOverrides: { root: { borderRadius: 4, height: 6, backgroundColor: alpha(t.textSecondary, 0.15) } } },
      MuiSkeleton: { styleOverrides: { root: { borderRadius: 6 } } },
      MuiDrawer: { styleOverrides: { paper: { backgroundImage: "none" } } },
      MuiAlert: { styleOverrides: { root: { borderRadius: 8, fontSize: 13 } } },
      MuiToggleButton: { styleOverrides: { root: { textTransform: "none", fontWeight: 600, fontSize: 12.5, padding: "4px 10px", borderColor: t.borderStrong } } },
    },
  });
}
