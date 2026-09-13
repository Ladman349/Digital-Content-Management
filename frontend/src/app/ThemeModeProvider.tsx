import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CssBaseline, ThemeProvider, type PaletteMode } from "@mui/material";
import { buildTheme, THEME_COLOR } from "./theme";

const STORAGE_KEY = "signage.theme";

interface ThemeModeContextValue {
  mode: PaletteMode;
  toggle: () => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue>({ mode: "dark", toggle: () => {} });

function initialMode(): PaletteMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* storage unavailable */
  }
  // The board is a dark-first design: default to dark unless the viewer has asked for light.
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PaletteMode>(initialMode);
  const toggle = useCallback(() => setMode((m) => (m === "light" ? "dark" : "light")), []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* storage unavailable */
    }
    document.documentElement.style.colorScheme = mode;
    // Phone browsers paint their own chrome in this colour; keep it on the same ground as the board.
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[mode]);
  }, [mode]);

  const theme = useMemo(() => buildTheme(mode), [mode]);
  const value = useMemo(() => ({ mode, toggle }), [mode, toggle]);

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useThemeMode() {
  return useContext(ThemeModeContext);
}
