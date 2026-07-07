import React from "react";
import ReactDOM from "react-dom/client";

import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

import { CssBaseline, ThemeProvider } from "@mui/material";
import { SnackbarProvider } from "notistack";

import theme from "./theme/theme";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <SnackbarProvider
                maxSnack={3}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                autoHideDuration={3500}
            >
                <App />
            </SnackbarProvider>
        </ThemeProvider>
    </React.StrictMode>
);