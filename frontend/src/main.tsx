import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SnackbarProvider } from "notistack";

import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

import { ThemeModeProvider } from "./app/ThemeModeProvider";
import App from "./App";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeModeProvider>
        <SnackbarProvider maxSnack={3} dense anchorOrigin={{ vertical: "bottom", horizontal: "right" }} autoHideDuration={3500}>
          <App />
        </SnackbarProvider>
      </ThemeModeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
