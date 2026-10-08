import { WS_URL } from "@/lib/config";

export type ConnectionState = "connecting" | "open" | "closed";

export interface ServerFrame {
  type: string;
  payload: unknown;
}

type FrameHandler = (frame: ServerFrame) => void;
type StateHandler = (state: ConnectionState) => void;

const PING_INTERVAL_MS = 25_000;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
const CLOSE_UNAUTHORIZED = 4401;

/**
 * One WebSocket per session. Authenticates with its first frame (keeps tokens out of URLs),
 * pings to keep the connection alive, and reconnects with exponential backoff plus jitter.
 * Knows nothing about chat; consumers subscribe to frames and connection state.
 */
export class SocketClient {
  private socket: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private wanted = false;
  private state: ConnectionState = "closed";
  private readonly frameHandlers = new Set<FrameHandler>();
  private readonly stateHandlers = new Set<StateHandler>();

  constructor(
    private readonly getToken: () => string | null,
    private readonly onUnauthorized: () => void,
  ) {}

  connect(): void {
    this.wanted = true;
    if (this.socket) return;
    this.open();
  }

  disconnect(): void {
    this.wanted = false;
    this.clearTimers();
    this.socket?.close(1000);
    this.socket = null;
    this.setState("closed");
  }

  /** Returns false when the frame couldn't be sent (offline); callers treat typing as best effort. */
  send(type: string, payload?: unknown): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify({ type, payload }));
    return true;
  }

  onFrame(handler: FrameHandler): () => void {
    this.frameHandlers.add(handler);
    return () => this.frameHandlers.delete(handler);
  }

  onState(handler: StateHandler): () => void {
    this.stateHandlers.add(handler);
    handler(this.state);
    return () => this.stateHandlers.delete(handler);
  }

  private open(): void {
    const token = this.getToken();
    if (!token) return;
    this.setState("connecting");

    const socket = new WebSocket(WS_URL);
    this.socket = socket;

    socket.onopen = () => socket.send(JSON.stringify({ type: "auth", token }));

    socket.onmessage = (event) => {
      let frame: ServerFrame;
      try {
        frame = JSON.parse(String(event.data)) as ServerFrame;
      } catch {
        return;
      }
      if (frame.type === "ready") {
        this.attempts = 0;
        this.startPing();
        this.setState("open");
      }
      this.frameHandlers.forEach((handler) => handler(frame));
    };

    socket.onclose = (event) => {
      if (this.socket !== socket) return; // a stale socket from before a reconnect
      this.socket = null;
      this.clearTimers();
      this.setState("closed");
      if (event.code === CLOSE_UNAUTHORIZED) {
        this.wanted = false;
        this.onUnauthorized();
        return;
      }
      if (this.wanted) this.scheduleReconnect();
    };

    // Errors are always followed by a close event, which owns the recovery logic.
    socket.onerror = () => {};
  }

  private scheduleReconnect(): void {
    const exponential = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** this.attempts);
    const delay = exponential / 2 + Math.random() * (exponential / 2);
    this.attempts += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      if (this.wanted) this.open();
    }, delay);
  }

  private startPing(): void {
    this.pingTimer = setInterval(() => this.send("ping"), PING_INTERVAL_MS);
  }

  private clearTimers(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.pingTimer = null;
    this.retryTimer = null;
  }

  private setState(next: ConnectionState): void {
    if (this.state === next) return;
    this.state = next;
    this.stateHandlers.forEach((handler) => handler(next));
  }
}
