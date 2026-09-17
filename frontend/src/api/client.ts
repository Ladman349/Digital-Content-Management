/**
 * Thin fetch wrapper for the FastAPI backend.
 * - Normalises VITE_API_URL so it always ends in /api/v1
 * - Parses FastAPI error bodies ({detail: string | ValidationError[]}) into readable messages
 * - Handles 204 No Content
 * - Sends the signed-in session on every request and reports a refused one to the auth provider
 */

import { notifyUnauthorized, session } from "../auth/session";

function normaliseBase(raw: string | undefined): string {
  let base = (raw || "http://localhost:8000/api/v1").trim();
  if (!/^https?:\/\//i.test(base)) {
    base = /localhost|127\.0\.0\.1/.test(base) ? `http://${base}` : `https://${base}`;
  }
  base = base.replace(/\/+$/, "");
  if (!/\/api\/v1$/.test(base)) base = `${base}/api/v1`;
  return base;
}

export const API_BASE = normaliseBase(import.meta.env.VITE_API_URL);
/** Origin without the /api/v1 suffix, for root-level endpoints like /ready. */
export const API_ROOT = API_BASE.replace(/\/api\/v1$/, "");

/**
 * Optional shared admin key from before user accounts existed. Anything in a Vite bundle is readable
 * by anyone who can load the CMS, so this was only ever a guard against anonymous traffic. With
 * accounts in use it should be left unset: a key baked into the bundle would make every visitor a
 * platform administrator, sign-in screen or not.
 */
const ADMIN_KEY = (import.meta.env.VITE_ADMIN_API_KEY || "").trim();

/**
 * Account-level routes are never narrowed to a client. Leaving the scope off them also means a
 * scope pointing at a client that has since been deleted cannot block the very request (the client
 * list) that lets the switcher notice and reset itself.
 */
const UNSCOPED = /^\/(auth|users|clients|app-updates)(\/|$|\?)/;

function authHeaders(url: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = session.getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  else if (ADMIN_KEY) headers["X-Admin-Key"] = ADMIN_KEY;
  // Administrators can work "as" one client; the server ignores this for everyone else.
  const scope = session.getScope();
  if (scope && !UNSCOPED.test(url)) headers["X-Client-Scope"] = scope;
  return headers;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type ValidationError = { loc?: (string | number)[]; msg?: string };

async function errorFromResponse(res: Response, fallback: string): Promise<ApiError> {
  let message = fallback;
  try {
    const data = await res.json();
    const detail = data?.detail;
    if (typeof detail === "string") message = detail;
    else if (Array.isArray(detail)) {
      message = (detail as ValidationError[])
        .map((e) => {
          const field = e.loc?.filter((p) => p !== "body").join(".");
          return field ? `${field}: ${e.msg}` : e.msg;
        })
        .filter(Boolean)
        .join("; ");
    }
  } catch {
    /* body was not JSON */
  }
  return new ApiError(message || fallback, res.status);
}

interface RequestOptions {
  /** The sign-in call itself: a 401 there means "wrong password", not "your session ended". */
  expect401?: boolean;
}

async function request<T>(method: string, url: string, body?: unknown, options: RequestOptions = {}): Promise<T> {
  const isForm = body instanceof FormData;
  const headers: Record<string, string> = { ...authHeaders(url) };
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${url}`, {
      method,
      headers: Object.keys(headers).length ? headers : undefined,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Cannot reach the API server", 0);
  }
  if (res.status === 401 && !options.expect401) {
    // The session ended, was revoked, or sign-in has just been switched on. Either way the answer
    // is the sign-in screen, which the auth provider shows when told.
    notifyUnauthorized();
    throw new ApiError("Your session has ended. Sign in again.", 401);
  }
  if (!res.ok) throw await errorFromResponse(res, `${method} ${url} failed (${res.status})`);
  if (res.status === 204 || res.headers.get("content-length") === "0") return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown, options?: RequestOptions) => request<T>("POST", url, body, options),
  put: <T>(url: string, body?: unknown) => request<T>("PUT", url, body),
  delete: (url: string) => request<void>("DELETE", url),
};

export interface UploadHandle<T> {
  promise: Promise<T>;
  abort: () => void;
}

/** Multipart upload with progress reporting (fetch has no upload progress, so XHR is used). */
export function uploadWithProgress<T>(url: string, form: FormData, onProgress?: (fraction: number) => void): UploadHandle<T> {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<T>((resolve, reject) => {
    xhr.open("POST", `${API_BASE}${url}`);
    Object.entries(authHeaders(url)).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(xhr.responseText ? (JSON.parse(xhr.responseText) as T) : (undefined as T));
        } catch {
          reject(new ApiError("Invalid server response", xhr.status));
        }
        return;
      }
      if (xhr.status === 401) notifyUnauthorized();
      let message = xhr.status === 401 ? "Your session has ended. Sign in again." : `Upload failed (${xhr.status})`;
      try {
        const data = JSON.parse(xhr.responseText);
        if (typeof data?.detail === "string") message = data.detail;
      } catch {
        /* ignore */
      }
      reject(new ApiError(message, xhr.status));
    };
    xhr.onerror = () => reject(new ApiError("Network error during upload", 0));
    xhr.onabort = () => reject(new ApiError("Upload cancelled", 0));
    xhr.send(form);
  });
  return { promise, abort: () => xhr.abort() };
}

export async function checkApiReady(): Promise<boolean> {
  try {
    const res = await fetch(`${API_ROOT}/ready`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}
