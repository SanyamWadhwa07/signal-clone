/** Backend base URL, e.g. http://localhost:8000 (no trailing slash). */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(
  /\/+$/,
  "",
);

/** The WebSocket endpoint lives on the same host: http -> ws, https -> wss. */
export const WS_URL = `${API_URL.replace(/^http/, "ws")}/ws`;

/** Uploaded files are served by the backend; resolve its relative paths to absolute URLs. */
export function assetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return path.startsWith("/") ? `${API_URL}${path}` : path;
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_MESSAGE_LENGTH = 4000;
