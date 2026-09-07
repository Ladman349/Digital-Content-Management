/**
 * Thin fetch wrapper for the FastAPI backend.
 * - Normalises VITE_API_URL so it always ends in /api/v1
 * - Parses FastAPI error bodies ({detail: string | ValidationError[]}) into readable messages
 * - Handles 204 No Content
 */

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
 * Shared admin key, sent on every request when the backend has ADMIN_API_KEY configured.
 *
 * Note this is a deployment-level guard, not user authentication: anything in a Vite bundle is
 * readable by anyone who can load the CMS. It stops anonymous access to the API from the open
 * internet, so pair it with SSO or a VPN in front of the CMS itself.
 */
const ADMIN_KEY = (import.meta.env.VITE_ADMIN_API_KEY || "").trim();

function authHeaders(): Record<string, string> {
  return ADMIN_KEY ? { "X-Admin-Key": ADMIN_KEY } : {};
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

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const headers: Record<string, string> = { ...authHeaders() };
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
  if (res.status === 401) {
    throw new ApiError(
      ADMIN_KEY
        ? "The API rejected this admin key. Check VITE_ADMIN_API_KEY matches ADMIN_API_KEY on the backend."
        : "This API requires an admin key. Set VITE_ADMIN_API_KEY for the CMS.",
      401,
    );
  }
  if (!res.ok) throw await errorFromResponse(res, `${method} ${url} failed (${res.status})`);
  if (res.status === 204 || res.headers.get("content-length") === "0") return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body),
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
    Object.entries(authHeaders()).forEach(([k, v]) => xhr.setRequestHeader(k, v));
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
      let message = `Upload failed (${xhr.status})`;
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
