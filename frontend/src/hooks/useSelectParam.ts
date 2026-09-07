import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Keeps the currently inspected record id in the URL (?select=ID) so deep links from the command palette,
 * the dashboard and the browser's back button all open the right inspector panel.
 */
export function useSelectParam(): [string | null, (id: string | null) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get("select");
  const set = useCallback(
    (id: string | null) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) next.set("select", id);
          else next.delete("select");
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  return [value, set];
}

/** Reads and writes an arbitrary filter param (e.g. ?status=Offline) without touching other params. */
export function useFilterParam(name: string, fallback: string): [string, (v: string) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get(name) ?? fallback;
  const set = useCallback(
    (v: string) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (v && v !== fallback) next.set(name, v);
          else next.delete(name);
          return next;
        },
        { replace: true },
      );
    },
    [setParams, name, fallback],
  );
  return [value, set];
}
