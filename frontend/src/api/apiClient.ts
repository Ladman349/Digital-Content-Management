/**
 * API client to route requests to real FastAPI backend.
 */

let rawBase = import.meta.env.VITE_API_URL || "http://localhost:8000";
if (rawBase && !rawBase.startsWith("http://") && !rawBase.startsWith("https://")) {
  if (rawBase.includes("localhost") || rawBase.includes("127.0.0.1")) {
    rawBase = `http://${rawBase}`;
  } else {
    rawBase = `https://${rawBase}`;
  }
}
export const API_BASE = rawBase;

export const apiClient = {
  get: async <T>(url: string): Promise<T> => {
    const res = await fetch(`${API_BASE}${url}`);
    if (!res.ok) throw new Error(`GET ${url} failed`);
    return res.json();
  },
  
  post: async <T>(url: string, body: any): Promise<T> => {
    const res = await fetch(`${API_BASE}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    
    // Attempt to parse JSON error response from FastAPI to surface validation errors
    if (!res.ok) {
      let errorMsg = `POST ${url} failed`;
      try {
        const errorData = await res.json();
        if (errorData && errorData.detail) {
          errorMsg = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
        }
      } catch (e) {
        // Ignored, fallback to generic error message
      }
      throw new Error(errorMsg);
    }
    
    // Return empty object for 204 No Content to avoid JSON parse errors
    if (res.status === 204) return {} as T;
    
    return res.json();
  },

  put: async <T>(url: string, body: any): Promise<T> => {
    const res = await fetch(`${API_BASE}${url}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    
    if (!res.ok) {
      let errorMsg = `PUT ${url} failed`;
      try {
        const errorData = await res.json();
        if (errorData && errorData.detail) {
          errorMsg = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
        }
      } catch (e) {
        // Ignored, fallback to generic error message
      }
      throw new Error(errorMsg);
    }
    
    if (res.status === 204) return {} as T;
    
    return res.json();
  },

  delete: async (url: string): Promise<void> => {
    const res = await fetch(`${API_BASE}${url}`, { method: "DELETE" });
    if (!res.ok) {
      let errorMsg = `DELETE ${url} failed`;
      try {
        const errorData = await res.json();
        if (errorData && errorData.detail) {
          errorMsg = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
        }
      } catch (e) {
        // Ignored, fallback to generic error message
      }
      throw new Error(errorMsg);
    }
  },
};
