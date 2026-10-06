import type { editor as MonacoEditor, IDisposable } from "monaco-editor";

/**
 * Editor activity capture for server-timed sprint attempts (POST /api/attempts/{id}/events).
 * The server replays every edit on top of the starter files and compares the result with the submission,
 * so edits must never be dropped or reordered: batches are numbered and retried until acknowledged.
 */

export type EditSource = "typed" | "paste" | "ai-assistant" | "undo" | "redo" | "starter";

export interface EditorEvent {
  t: number;
  type: "edit" | "blur" | "focus" | "run";
  file?: string;
  offset?: number;
  deleteLength?: number;
  text?: string;
  source?: EditSource;
  interactionId?: string;
}

export interface ContentChange {
  rangeOffset: number;
  rangeLength: number;
  text: string;
}

export type TelemetryState = "ok" | "retrying" | "stopped";

export interface EditorTelemetryOptions {
  attemptId: string;
  nextSequence: number;
  serverElapsedMs: number;
  apiBaseUrl: string;
  getToken: () => Promise<string | null>;
  flushIntervalMs?: number;
  fetchImpl?: typeof fetch;
  clock?: () => number;
  onStateChange?: (state: TelemetryState) => void;
}

interface Batch {
  sequence: number;
  clientStartMs: number;
  clientEndMs: number;
  events: EditorEvent[];
  attempts: number;
}

// Server limits are 5,000 events / 400,000 text chars / 1 MB per batch; stay well below them
const MAX_EVENT_TEXT = 50_000;
const MAX_BATCH_EVENTS = 1_000;
const MAX_BATCH_TEXT = 150_000;
const KEEPALIVE_MAX_BYTES = 60_000;

export function normalizeEol(s: string): string {
  return s.replace(/\r\n?/g, "\n");
}

/**
 * Converts one Monaco content-change event into replayable edit events. All changes in one event are relative
 * to the model before the event, so they are emitted bottom-up (descending offset) and can be applied in order.
 * Ties keep Monaco's own order, which is already its application order.
 */
export function changesToEditEvents(
  changes: readonly ContentChange[],
  file: string,
  t: number,
  source: EditSource,
  interactionId?: string
): EditorEvent[] {
  const ordered = changes
    .map((change, index) => ({ change, index }))
    .sort((a, b) => b.change.rangeOffset - a.change.rangeOffset || a.index - b.index);

  const events: EditorEvent[] = [];
  const push = (offset: number, deleteLength: number, text: string) => {
    const event: EditorEvent = { t, type: "edit", file, offset, deleteLength, text, source };
    if (interactionId) event.interactionId = interactionId;
    events.push(event);
  };

  for (const { change } of ordered) {
    const text = normalizeEol(change.text);
    if (change.rangeLength === 0 && text.length === 0) continue;
    if (text.length <= MAX_EVENT_TEXT) {
      push(change.rangeOffset, change.rangeLength, text);
      continue;
    }
    // Very large inserts are split into consecutive inserts so each batch stays under the server limits
    let offset = change.rangeOffset;
    let deleteLength = change.rangeLength;
    let pos = 0;
    while (pos < text.length) {
      let end = Math.min(pos + MAX_EVENT_TEXT, text.length);
      const code = text.charCodeAt(end - 1);
      if (end < text.length && code >= 0xd800 && code <= 0xdbff) end -= 1; // never split a surrogate pair
      const chunk = text.slice(pos, end);
      push(offset, deleteLength, chunk);
      offset += chunk.length;
      deleteLength = 0;
      pos = end;
    }
  }
  return events;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class EditorTelemetry {
  private readonly attemptId: string;
  private readonly apiBaseUrl: string;
  private readonly getToken: () => Promise<string | null>;
  private readonly fetchImpl: typeof fetch;
  private readonly clock: () => number;
  private readonly origin: number;
  private readonly baseMs: number;
  private readonly flushIntervalMs: number;
  private readonly onStateChange?: (state: TelemetryState) => void;

  private pending: EditorEvent[] = [];
  private outbox: Batch[] = [];
  private nextSequence: number;
  private lastBatchEnd: number;
  private sending: Promise<void> | null = null;
  private fatal = false;
  private stopped = false;
  private state: TelemetryState = "ok";
  private token: string | null = null;

  private forced: { source: EditSource; interactionId?: string } | null = null;
  private pasteArmed = false;
  private recentTyped: EditorEvent[] = [];
  private recentTimer: ReturnType<typeof setTimeout> | null = null;
  private interval: ReturnType<typeof setInterval> | null = null;
  private detachWindow: (() => void) | null = null;

  constructor(options: EditorTelemetryOptions) {
    this.attemptId = options.attemptId;
    this.apiBaseUrl = options.apiBaseUrl.replace(/\/$/, "");
    this.getToken = options.getToken;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.clock = options.clock ?? (() => performance.now());
    this.origin = this.clock();
    this.baseMs = Math.max(0, options.serverElapsedMs || 0);
    this.nextSequence = options.nextSequence;
    this.lastBatchEnd = this.baseMs;
    this.flushIntervalMs = options.flushIntervalMs ?? 5000;
    this.onStateChange = options.onStateChange;
  }

  /** Milliseconds since the attempt started, continuing from the server's elapsed time on resume. */
  now(): number {
    return Math.round((this.baseMs + (this.clock() - this.origin)) * 10) / 10;
  }

  /** Starts periodic flushing and window focus/visibility capture. Browser only. */
  start(): void {
    if (this.interval || this.stopped) return;
    this.interval = setInterval(() => {
      void this.refreshToken();
      void this.flush();
    }, this.flushIntervalMs);
    void this.refreshToken();

    if (typeof window === "undefined") return;
    const onBlur = () => this.recordFocus(false);
    const onFocus = () => this.recordFocus(true);
    const onVisibility = () => this.recordFocus(document.visibilityState === "visible");
    const onPageHide = () => this.flushKeepalive();
    const onOnline = () => void this.flush();
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("online", onOnline);
    this.detachWindow = () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("online", onOnline);
    };
  }

  /** Captures edits on one file's model. Each file in a multi-file task has its own model. */
  trackModel(model: MonacoEditor.ITextModel, fileName: string): IDisposable {
    return model.onDidChangeContent((e) => this.handleContentChange(e, fileName));
  }

  handleContentChange(
    e: Pick<MonacoEditor.IModelContentChangedEvent, "changes" | "isUndoing" | "isRedoing">,
    fileName: string
  ): void {
    if (this.stopped) return;
    let source: EditSource = "typed";
    let interactionId: string | undefined;
    if (this.forced) {
      source = this.forced.source;
      interactionId = this.forced.interactionId;
    } else if (e.isUndoing) {
      source = "undo";
    } else if (e.isRedoing) {
      source = "redo";
    } else if (this.pasteArmed) {
      source = "paste";
      this.pasteArmed = false;
    }

    const events = changesToEditEvents(e.changes, fileName, this.now(), source, interactionId);
    this.pending.push(...events);

    if (source === "typed" && events.length > 0) {
      // Monaco fires onDidPaste right after the paste's content change, in the same task
      this.recentTyped.push(...events);
      if (!this.recentTimer) {
        this.recentTimer = setTimeout(() => {
          this.recentTyped = [];
          this.recentTimer = null;
        }, 0);
      }
    }
  }

  /** Tags pastes. Handles both orders: paste notification after the change (Monaco) or before it (DOM paste). */
  trackEditor(editor: MonacoEditor.ICodeEditor): IDisposable {
    const pasteListener = editor.onDidPaste(() => this.markPaste());
    const node = editor.getContainerDomNode();
    const onDomPaste = () => this.armPaste();
    node.addEventListener("paste", onDomPaste, true);
    return {
      dispose: () => {
        pasteListener.dispose();
        node.removeEventListener("paste", onDomPaste, true);
      },
    };
  }

  markPaste(): void {
    if (this.recentTyped.length > 0) {
      for (const event of this.recentTyped) {
        if (event.source === "typed") event.source = "paste";
      }
      this.recentTyped = [];
      this.pasteArmed = false;
    } else {
      this.armPaste();
    }
  }

  private armPaste(): void {
    this.pasteArmed = true;
    setTimeout(() => {
      this.pasteArmed = false;
    }, 0);
  }

  /** Runs a programmatic edit (assistant insert, starter reset) so its content change carries that source. */
  runAs<T>(source: EditSource, interactionId: string | undefined, edit: () => T): T {
    const previous = this.forced;
    this.forced = { source, interactionId };
    try {
      return edit();
    } finally {
      this.forced = previous;
    }
  }

  recordRun(): void {
    if (!this.stopped) this.pending.push({ t: this.now(), type: "run" });
  }

  recordFocus(focused: boolean): void {
    if (!this.stopped) this.pending.push({ t: this.now(), type: focused ? "focus" : "blur" });
  }

  hasUnsent(): boolean {
    return this.pending.length > 0 || this.outbox.length > 0;
  }

  /** Sends everything recorded so far. Resolves true when the server has acknowledged all of it. */
  async flush(): Promise<boolean> {
    while (this.sending) await this.sending;
    if (this.fatal) return false;
    this.cutBatches();
    if (this.outbox.length === 0) return true;

    this.sending = this.drain();
    try {
      await this.sending;
    } finally {
      this.sending = null;
    }
    return !this.fatal && this.outbox.length === 0;
  }

  /** Flush with retries until nothing is left unsent, for submit. */
  async flushAll(maxTries = 5): Promise<boolean> {
    for (let i = 0; i < maxTries; i++) {
      const ok = await this.flush();
      if (ok && !this.hasUnsent()) return true;
      if (this.fatal) return false;
      if (!ok) await sleep(400 * 2 ** i);
    }
    return false;
  }

  /**
   * Best-effort send while the page is being unloaded. Sends a single keepalive request so batches cannot arrive
   * out of order; nothing is sent while a normal request is still in flight.
   */
  flushKeepalive(): void {
    if (this.fatal || this.sending || !this.token) return;

    let batch: Batch;
    if (this.outbox.length > 0 && this.outbox[0].attempts > 0) {
      // A batch the server may already have stored is resent unchanged
      batch = this.outbox[0];
    } else {
      const events = [...this.outbox.flatMap((b) => b.events), ...this.pending];
      if (events.length === 0) return;
      const sequence = this.outbox.length > 0 ? this.outbox[0].sequence : this.nextSequence;
      const clientStartMs = this.outbox.length > 0 ? this.outbox[0].clientStartMs : this.lastBatchEnd;

      const encoder = new TextEncoder();
      let bytes = 200;
      let count = 0;
      while (count < events.length && count < MAX_BATCH_EVENTS) {
        const size = encoder.encode(JSON.stringify(events[count])).length + 1;
        if (count > 0 && bytes + size > KEEPALIVE_MAX_BYTES) break;
        bytes += size;
        count++;
      }

      const head = events.slice(0, count);
      const rest = events.slice(count);
      const end = head[head.length - 1].t;
      batch = { sequence, clientStartMs, clientEndMs: end, events: head, attempts: 0 };
      this.outbox = [batch];
      this.pending = [];
      this.nextSequence = sequence + 1;
      this.lastBatchEnd = end;
      if (rest.length > 0) {
        this.pending = rest;
        this.cutBatches();
      }
    }

    const body = this.serialize(batch);
    if (new TextEncoder().encode(body).length > KEEPALIVE_MAX_BYTES) return;
    batch.attempts++;
    try {
      void this.fetchImpl(this.eventsUrl(), {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.token}` },
        body,
      }).catch(() => undefined);
    } catch {
      // keepalive rejected by the browser; the batch stays queued
    }
  }

  /** Stops capture and timers. Pass flush=true to send what is left (not during unload). */
  dispose(options: { flush?: boolean } = {}): void {
    if (this.stopped) return;
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.detachWindow?.();
    this.detachWindow = null;
    if (options.flush) void this.flush();
    this.stopped = true;
  }

  private cutBatches(): void {
    while (this.pending.length > 0) {
      let count = 0;
      let chars = 0;
      while (count < this.pending.length && count < MAX_BATCH_EVENTS) {
        const len = this.pending[count].text?.length ?? 0;
        if (count > 0 && chars + len > MAX_BATCH_TEXT) break;
        chars += len;
        count++;
      }
      const events = this.pending.splice(0, count);
      const end = Math.max(this.lastBatchEnd, events[events.length - 1].t);
      this.outbox.push({
        sequence: this.nextSequence++,
        clientStartMs: this.lastBatchEnd,
        clientEndMs: end,
        events,
        attempts: 0,
      });
      this.lastBatchEnd = end;
    }
  }

  private async drain(): Promise<void> {
    while (this.outbox.length > 0 && !this.fatal) {
      const batch = this.outbox[0];
      const result = await this.post(batch);
      if (result === "ok") {
        this.outbox.shift();
      } else if (result === "fatal") {
        this.fatal = true;
        this.stopped = true;
        this.setState("stopped");
        return;
      } else {
        this.setState("retrying");
        return;
      }
    }
    this.setState("ok");
  }

  private async post(batch: Batch): Promise<"ok" | "retry" | "fatal"> {
    batch.attempts++;
    try {
      const token = await this.refreshToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await this.fetchImpl(this.eventsUrl(), { method: "POST", headers, body: this.serialize(batch) });
      if (res.ok) return "ok";
      if (res.status === 401 || res.status === 408 || res.status === 429 || res.status >= 500) return "retry";
      return "fatal";
    } catch {
      return "retry";
    }
  }

  private async refreshToken(): Promise<string | null> {
    try {
      const token = await this.getToken();
      if (token) this.token = token;
      return token;
    } catch {
      return this.token;
    }
  }

  private serialize(batch: Batch): string {
    return JSON.stringify({
      sequence: batch.sequence,
      clientStartMs: batch.clientStartMs,
      clientEndMs: batch.clientEndMs,
      events: batch.events,
    });
  }

  private eventsUrl(): string {
    return `${this.apiBaseUrl}/api/attempts/${this.attemptId}/events`;
  }

  private setState(state: TelemetryState): void {
    if (this.state === state) return;
    this.state = state;
    this.onStateChange?.(state);
  }
}
