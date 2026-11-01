// =====================================================
// QUANTARA — API CLIENT
// =====================================================

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "/api";

// =====================================================
// API TYPES
// =====================================================

type CsrfResponse = {
  headerName: string;
  token: string;
};

type ApiErrorResponse = {
  message?: string;
  error?: string;
};

// =====================================================
// CUSTOM API ERROR
// =====================================================

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);

    this.name = "ApiError";
    this.status = status;
  }
}

// =====================================================
// CSRF TOKEN
// =====================================================

async function getCsrfToken(): Promise<CsrfResponse> {
  const response = await fetch(
    `${API_BASE_URL}/auth/csrf`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new ApiError(
      response.status,
      "Unable to initialize secure connection"
    );
  }

  return response.json() as Promise<CsrfResponse>;
}

// =====================================================
// API REQUEST HELPER
// =====================================================

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();

  const headers = new Headers(options.headers);

  headers.set("Accept", "application/json");

  // ===================================================
  // CONTENT TYPE
  // ===================================================

  if (
    options.body &&
    !(options.body instanceof FormData)
  ) {
    headers.set("Content-Type", "application/json");
  }

  // ===================================================
  // CSRF PROTECTION
  // ===================================================

  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrf = await getCsrfToken();

    headers.set(csrf.headerName, csrf.token);
  }

  // ===================================================
  // SEND API REQUEST
  // ===================================================

  const response = await fetch(
    `${API_BASE_URL}${endpoint}`,
    {
      ...options,
      method,
      headers,
      credentials: "include",
    }
  );

  // ===================================================
  // HANDLE API ERRORS
  // ===================================================

  if (!response.ok) {
    if (response.status === 401 && endpoint !== "/auth/me" && endpoint !== "/auth/login") {
      window.dispatchEvent(new Event("quantara:session-expired"));
    }

    let message =
      "Something went wrong. Please try again.";

    try {
      const errorData =
        (await response.json()) as ApiErrorResponse;

      message =
        errorData.message ||
        errorData.error ||
        message;
    } catch {
      // Keep the fallback error message.
    }

    throw new ApiError(response.status, message);
  }

  // ===================================================
  // HANDLE EMPTY RESPONSES
  // ===================================================

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// =====================================================
// AUTH API TYPES
// =====================================================

export type SignupPayload = {
  fullName: string;
  email: string;
  password: string;
};

export type SignupResponse = {
  message: string;
  userId: string;
};

// =====================================================
// SIGNUP API
// =====================================================

export function signup(
  payload: SignupPayload
): Promise<SignupResponse> {
  return apiRequest<SignupResponse>(
    "/auth/signup",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function streamRequest<T>(endpoint: string, payload: unknown, onToken: (token: string) => void): Promise<T> {
  const csrf = await getCsrfToken();
  const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', [csrf.headerName]: csrf.token }, body: JSON.stringify(payload) });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unable to start the AI response' }));
    throw new ApiError(response.status, error.message || 'Unable to start the AI response');
  }
  if (!response.body) throw new Error('Streaming is not available in this browser');
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''; let draft: T | undefined;
  function parse(block: string) {
    const event = block.split('\n').find(line => line.startsWith('event:'))?.slice(6).trim();
    const text = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
    if (!text) return;
    const data = JSON.parse(text);
    if (event === 'token') onToken(data.text || '');
    if (event === 'draft') draft = data as T;
    if (event === 'error') throw new Error(data.message || 'The model could not finish this response');
  }
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n'); let index: number; while ((index = buffer.indexOf('\n\n')) >= 0) { parse(buffer.slice(0, index)); buffer = buffer.slice(index + 2); } }
    if (buffer.trim()) parse(buffer);
  } finally { await reader.cancel(); }
  if (!draft) throw new Error('The model response ended before a validated SQL draft was received');
  return draft;
}
