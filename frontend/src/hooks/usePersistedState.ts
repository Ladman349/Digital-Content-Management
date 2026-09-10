import { useEffect, useState } from "react";

/** useState backed by localStorage for small UI preferences (view mode, density). */
export function usePersistedState<T extends string>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      return (localStorage.getItem(key) as T | null) ?? initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage unavailable */
    }
  }, [key, value]);
  return [value, setValue];
}
