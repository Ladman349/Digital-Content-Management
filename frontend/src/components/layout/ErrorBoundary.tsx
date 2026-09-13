import { Component, type ErrorInfo, type ReactNode } from "react";
import { Box, Button, Typography } from "@mui/material";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches a render crash inside a page so the header and tabs stay usable and the operator can move
 * to another page instead of staring at a blank window. AppShell remounts it per route.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Page crashed", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Box
        role="alert"
        sx={(t) => ({
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          py: 7,
          px: 3,
          bgcolor: "board.cell",
          boxShadow: `inset 3px 0 0 ${t.palette.error.main}`,
        })}
      >
        <ReportProblemOutlinedIcon sx={{ fontSize: 26, color: "error.main", mb: 1.5 }} />
        <Typography sx={{ fontSize: 15, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.02em" }}>This page stopped working</Typography>
        <Typography sx={{ mt: 0.75, maxWidth: 460, fontSize: 12.5, color: "text.secondary", lineHeight: 1.55, overflowWrap: "anywhere" }}>
          {this.state.error.message}
        </Typography>
        <Box sx={{ display: "flex", gap: 1, mt: 2.5 }}>
          <Button variant="outlined" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
          <Button variant="contained" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </Box>
      </Box>
    );
  }
}
