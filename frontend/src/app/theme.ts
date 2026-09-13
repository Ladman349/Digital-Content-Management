import { alpha, createTheme } from "@mui/material/styles";
import type { PaletteMode } from "@mui/material";

/**
 * "Departure board" visual language.
 *
 * The CMS looks like the medium it manages: near-black ground, slatted rows separated by gaps rather
 * than rules, uppercase names in a wide grotesque, and tabular figures for everything measured.
 *
 * Two registers run through the whole app:
 *   board — big uppercase rows for scanning a list, from a desk or from across the room.
 *   bench — a quieter lifted panel for the things a board cannot do: forms, sequences, settings.
 *
 * Amber is the only brand colour and it means exactly one thing: this is what is playing. Health is
 * carried by success/error, which is why the two never compete.
 */

export const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
export const DISPLAY = "'Archivo', 'Helvetica Neue', Arial, sans-serif";

/** Amber is the same fill in both themes — it is the identity, and it reads on either ground. */
export const AMBER = "#F2C230";

/** Fingers need more than a mouse pointer does; every interactive control grows under this query. */
const TOUCH = "@media (pointer: coarse)";

const dark = {
  bg: "#0B0B0C",
  paper: "#141416",
  bench: "#1A1A1D",
  border: "#232326",
  borderStrong: "#3E3E43",
  text: "#F3F1EC",
  textSecondary: "#8C8A84",
  textDisabled: "#56555A",
  hover: "#1F1F23",
  subtle: "#0F0F11",
  amberInk: "#0B0B0C",
  primary: AMBER,
};

const light = {
  bg: "#E9E7E0",
  paper: "#FFFFFF",
  bench: "#F6F4EE",
  border: "#DAD7CE",
  borderStrong: "#B6B2A6",
  text: "#17171A",
  textSecondary: "#63605A",
  textDisabled: "#96928A",
  hover: "#F2F0E9",
  subtle: "#FAF9F5",
  amberInk: "#231A00",
  // Amber is unreadable as text on white, so links and text-primary use a deepened tone.
  // Fills keep the true amber via palette.board.amber.
  primary: "#7A5600",
};

/** The browser chrome colour for each mode, mirrored into <meta name="theme-color"> by the provider. */
export const THEME_COLOR: Record<PaletteMode, string> = { dark: dark.bg, light: light.bg };

declare module "@mui/material/styles" {
  interface Palette {
    surface: { border: string; borderStrong: string; hover: string; subtle: string };
    board: { amber: string; amberInk: string; cell: string; bench: string; grid: string };
  }
  interface PaletteOptions {
    surface?: { border: string; borderStrong: string; hover: string; subtle: string };
    board?: { amber: string; amberInk: string; cell: string; bench: string; grid: string };
  }
}

export function buildTheme(mode: PaletteMode) {
  const t = mode === "light" ? light : dark;
  const isDark = mode === "dark";

  return createTheme({
    palette: {
      mode,
      primary: { main: t.primary, contrastText: t.amberInk },
      success: { main: isDark ? "#4ADE80" : "#1E7F45" },
      warning: { main: isDark ? "#F2C230" : "#7A5600" },
      error: { main: isDark ? "#F05A5A" : "#C0362F" },
      info: { main: isDark ? "#6BA8E8" : "#1D5E9E" },
      background: { default: t.bg, paper: t.paper },
      text: { primary: t.text, secondary: t.textSecondary, disabled: t.textDisabled },
      divider: t.border,
      surface: { border: t.border, borderStrong: t.borderStrong, hover: t.hover, subtle: t.subtle },
      board: { amber: AMBER, amberInk: t.amberInk, cell: t.paper, bench: t.bench, grid: t.bg },
    },

    // The board is square. Radius exists only to soften inputs a hair.
    shape: { borderRadius: 2 },

    typography: {
      fontFamily: DISPLAY,
      fontSize: 13.5,
      // Page name, board-style: wide tracking, uppercase applied at the component.
      h1: { fontFamily: DISPLAY, fontSize: 15, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase" },
      h2: { fontSize: 18, fontWeight: 700, letterSpacing: "-0.015em" },
      h3: { fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" },
      // The row lead — a screen name, a filename, a release.
      subtitle1: { fontSize: 20, fontWeight: 700, letterSpacing: "-0.005em", textTransform: "uppercase", lineHeight: 1.15 },
      // Column heads and bench section labels.
      subtitle2: { fontSize: 9.5, fontWeight: 700, letterSpacing: "0.19em", textTransform: "uppercase" },
      body1: { fontSize: 13.5 },
      body2: { fontSize: 12.5 },
      caption: { fontFamily: MONO, fontSize: 11, letterSpacing: "0.04em" },
      button: { textTransform: "uppercase", fontWeight: 700, fontSize: 11, letterSpacing: "0.14em" },
    },

    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: {
            // Safe areas on notched phones; keeps the board from sliding under the home indicator.
            paddingLeft: "env(safe-area-inset-left)",
            paddingRight: "env(safe-area-inset-right)",
            // Editors are full-screen sheets on phones; the page behind them must not rubber-band.
            overscrollBehaviorY: "none",
          },
          body: { backgroundColor: t.bg, color: t.text, WebkitFontSmoothing: "antialiased", WebkitTapHighlightColor: "transparent" },
          "*::-webkit-scrollbar": { width: 10, height: 10 },
          "*::-webkit-scrollbar-thumb": {
            backgroundColor: alpha(t.textSecondary, 0.35),
            border: "2px solid transparent",
            backgroundClip: "padding-box",
          },
          "*::-webkit-scrollbar-track": { background: "transparent" },
          // Keyboard focus is the one place amber is allowed to mean "here", not "playing": it is
          // transient and never sits next to a playing marker for long.
          ":focus-visible": { outline: `2px solid ${AMBER}`, outlineOffset: 2 },
          "@media (prefers-reduced-motion: reduce)": {
            "*, *::before, *::after": {
              animationDuration: "0.01ms !important",
              animationIterationCount: "1 !important",
              transitionDuration: "0.01ms !important",
              scrollBehavior: "auto !important",
            },
          },
        },
      },

      MuiButton: {
        defaultProps: { size: "small", disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 2, padding: "7px 14px", minHeight: 32, whiteSpace: "nowrap", [TOUCH]: { minHeight: 40 } },
          contained: { backgroundColor: AMBER, color: t.amberInk, "&:hover": { backgroundColor: "#FFD24A" } },
          outlined: {
            backgroundColor: isDark ? "#26262A" : t.subtle,
            borderColor: t.borderStrong,
            color: t.text,
            "&:hover": { backgroundColor: t.hover, borderColor: t.borderStrong },
          },
          text: { color: t.textSecondary, "&:hover": { color: t.text, backgroundColor: t.hover } },
        },
      },
      MuiIconButton: {
        defaultProps: { size: "small" },
        styleOverrides: {
          root: {
            borderRadius: 2,
            color: t.textSecondary,
            "&:hover": { color: t.text, backgroundColor: t.hover },
            [TOUCH]: { padding: 10 },
          },
        },
      },
      MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: "none" } } },

      MuiChip: {
        defaultProps: { size: "small" },
        styleOverrides: {
          root: { fontWeight: 700, borderRadius: 2, height: 21, fontSize: 10, letterSpacing: "0.11em", textTransform: "uppercase" },
          label: { paddingLeft: 8, paddingRight: 8 },
        },
      },

      MuiTextField: { defaultProps: { size: "small" } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 2,
            backgroundColor: t.subtle,
            fontFamily: MONO,
            fontSize: 12.5,
            "& .MuiOutlinedInput-notchedOutline": { borderColor: t.border },
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: t.borderStrong },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: AMBER, borderWidth: 1.5 },
          },
          // 16px on touch stops iOS Safari zooming the page every time a field is focused.
          input: { padding: "8px 10px", [TOUCH]: { fontSize: 16, padding: "10px 10px" } },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: t.textSecondary,
            "&.Mui-focused": { color: t.textSecondary },
          },
        },
      },
      MuiFormLabel: { styleOverrides: { root: { "&.Mui-focused": { color: t.textSecondary } } } },

      // Rows are slats: separate cells with a 2px gap showing the ground through.
      MuiTable: { styleOverrides: { root: { borderCollapse: "separate", borderSpacing: "0 2px" } } },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottom: 0, padding: "14px", fontSize: 13, backgroundColor: t.paper },
          head: {
            backgroundColor: "transparent",
            padding: "10px 14px 8px",
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: "0.19em",
            textTransform: "uppercase",
            color: t.textSecondary,
            whiteSpace: "nowrap",
          },
        },
      },
      MuiTableSortLabel: {
        styleOverrides: {
          root: { color: "inherit", "&:hover": { color: t.text }, "&.Mui-active": { color: t.text } },
          icon: { fontSize: 15 },
        },
      },

      MuiCheckbox: { styleOverrides: { root: { color: t.textDisabled, "&.Mui-checked": { color: AMBER }, [TOUCH]: { padding: 11 } } } },
      MuiSwitch: { styleOverrides: { track: { backgroundColor: t.textDisabled } } },

      MuiTooltip: {
        defaultProps: { arrow: true, enterDelay: 400 },
        styleOverrides: { tooltip: { fontSize: 11.5, borderRadius: 2, padding: "6px 9px", fontFamily: MONO } },
      },

      MuiDialog: {
        styleOverrides: {
          paper: ({ theme }) => ({
            borderRadius: 3,
            border: `1px solid ${t.borderStrong}`,
            backgroundColor: t.bench,
            boxShadow: "0 28px 70px -12px rgba(0,0,0,0.6)",
            backgroundImage: "none",
            // MUI's default 32px margin on each side leaves a 311px dialog on a 375px phone.
            [theme.breakpoints.down("sm")]: {
              "&:not(.MuiDialog-paperFullScreen)": { margin: 12, width: "calc(100% - 24px)", maxHeight: "calc(100% - 24px)" },
              "&.MuiDialog-paperFullScreen": { border: 0, borderRadius: 0, paddingBottom: "env(safe-area-inset-bottom)" },
            },
          }),
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: { fontSize: 11, fontWeight: 800, letterSpacing: "0.19em", textTransform: "uppercase", color: t.textSecondary, padding: "18px 22px 10px" },
        },
      },
      MuiDialogContent: { styleOverrides: { root: { padding: "8px 22px 16px" } } },
      MuiDialogActions: { styleOverrides: { root: { padding: "10px 22px 18px", flexWrap: "wrap", gap: 4 } } },

      MuiMenu: { styleOverrides: { paper: { border: `1px solid ${t.borderStrong}`, backgroundColor: t.bench, borderRadius: 2 } } },
      MuiMenuItem: { styleOverrides: { root: { fontSize: 12.5, minHeight: 34, borderRadius: 0, [TOUCH]: { minHeight: 44 } } } },
      MuiListItemIcon: { styleOverrides: { root: { minWidth: 30, color: t.textSecondary } } },

      MuiLinearProgress: {
        styleOverrides: {
          root: { borderRadius: 0, height: 4, backgroundColor: alpha(t.textSecondary, 0.2) },
          bar: { borderRadius: 0 },
        },
      },
      MuiSkeleton: { styleOverrides: { root: { borderRadius: 0, backgroundColor: alpha(t.textSecondary, 0.13) } } },
      MuiDrawer: { styleOverrides: { paper: { backgroundImage: "none", backgroundColor: t.bench } } },
      MuiAlert: { styleOverrides: { root: { borderRadius: 2, fontSize: 13 } } },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            textTransform: "uppercase",
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: "0.11em",
            padding: "6px 11px",
            borderColor: t.border,
            color: t.textSecondary,
            "&.Mui-selected": { backgroundColor: t.paper, color: t.text },
            [TOUCH]: { minHeight: 40 },
          },
        },
      },
    },
  });
}
