import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",

    primary: {
      main: "#6C4CF1",
      light: "#8B5CF6",
      dark: "#5538EE",
      contrastText: "#FFFFFF",
    },

    secondary: {
      main: "#3B82F6",
      light: "#60A5FA",
      dark: "#2563EB",
      contrastText: "#FFFFFF",
    },

    success: {
      main: "#10B981",
      light: "#34D399",
      dark: "#059669",
    },

    warning: {
      main: "#F59E0B",
      light: "#FBBF24",
      dark: "#D97706",
    },

    error: {
      main: "#EF4444",
      light: "#F87171",
      dark: "#DC2626",
    },

    info: {
      main: "#0EA5E9",
      light: "#38BDF8",
      dark: "#0284C7",
    },

    background: {
      default: "#F8FAFC",
      paper: "#FFFFFF",
    },

    text: {
      primary: "#0F172A",
      secondary: "#64748B",
    },

    divider: "#EEF2F6",
  },

  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",

    h4: {
      fontWeight: 800,
      letterSpacing: "-0.025em",
    },

    h5: {
      fontWeight: 700,
      letterSpacing: "-0.02em",
    },

    h6: {
      fontWeight: 700,
      letterSpacing: "-0.015em",
    },

    subtitle1: {
      fontWeight: 600,
    },

    subtitle2: {
      fontWeight: 600,
      letterSpacing: "0.01em",
    },

    button: {
      textTransform: "none",
      fontWeight: 600,
      letterSpacing: "0.01em",
    },
  },

  shape: {
    borderRadius: 14,
  },

  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: "#F8FAFC",
          color: "#0F172A",
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
        },
      },
    },

    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: "8px 18px",
          transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          boxShadow: "none",
          "&:hover": {
            boxShadow: "0 4px 14px rgba(108, 76, 241, 0.25)",
            transform: "translateY(-1px)",
          },
          "&:active": {
            transform: "translateY(0)",
          },
        },
        contained: {
          boxShadow: "none",
        },
        outlined: {
          borderWidth: "1.5px",
          "&:hover": {
            borderWidth: "1.5px",
          },
        },
      },
    },

    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          border: "1px solid #EEF2F6",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 24px -4px rgba(0,0,0,0.04)",
          transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
        },
      },
    },

    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 18,
        },
        elevation0: {
          border: "1px solid #EEF2F6",
        },
      },
    },

    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 10,
        },
      },
    },

    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: "#FFFFFF",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#E2E8F0",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#CBD5E1",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#6C4CF1",
            borderWidth: "2px",
          },
        },
      },
    },

    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        },
      },
    },

    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          borderRadius: 8,
          backgroundColor: "#0F172A",
          fontSize: 12,
          fontWeight: 500,
          padding: "6px 12px",
        },
      },
    },
  },
});

export default theme;