/**
 * Where the signed-in session lives between page loads.
 *
 * Kept outside React on purpose: the API client needs the token on every request, including ones
 * fired before any component has mounted, and it has to be able to say "that token was refused"
 * without importing the provider that would then import it back.
 *
 * localStorage rather than a cookie because the same bundle runs inside the Capacitor shells, where
 * the page is served from capacitor://localhost and a cross-site cookie to the API would be dropped.
 */

const TOKEN_KEY = "signage.session";
const SCOPE_KEY = "signage.clientScope";

function read(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return ""; // private mode, or storage blocked: behave as signed out
  }
}

function write(key: string, value: string) {
  try {
    if (value) window.localStorage.setItem(key, value);
    else window.localStorage.removeItem(key);
  } catch {
    /* nothing useful to do; the session simply will not survive a reload */
  }
}

let token = read(TOKEN_KEY);
let scope = read(SCOPE_KEY);

export const session = {
  getToken: () => token,
  setToken(next: string) {
    token = next;
    write(TOKEN_KEY, next);
  },
  /** The client an administrator is currently working as; empty means "everything". */
  getScope: () => scope,
  setScope(next: string) {
    scope = next;
    write(SCOPE_KEY, next);
  },
  clear() {
    this.setToken("");
    this.setScope("");
  },
};

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();

/** Called by the API client when the server answers 401; the auth provider reacts by showing sign-in. */
export function notifyUnauthorized() {
  unauthorizedListeners.forEach((fn) => fn());
}

export function onUnauthorized(fn: Listener): () => void {
  unauthorizedListeners.add(fn);
  return () => unauthorizedListeners.delete(fn);
}
