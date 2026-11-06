/**
 * One voice call to OpenAI Realtime through the Edulexa API (6 Nov 2026). The browser makes the WebRTC offer; `exchange` sends
 * it to the API, which opens the call (instructions and key stay on the server) and returns OpenAI's answer. Used by the
 * graded defenses (VoiceDefenseRoom, the internship defense).
 *
 * A dropped network is given a moment to come back: "disconnected" only ends the call if the connection hasn't recovered
 * after `graceMs`. `onEnded` runs once, when the call ends by itself (never after `close()`).
 */

export interface RealtimeCaption {
  role: "student" | "interviewer";
  text: string;
}

export interface RealtimeCallOptions {
  mic: MediaStream;
  audio: HTMLAudioElement | null;
  /** Sends the SDP offer to the API; resolves with the SDP answer */
  exchange: (sdpOffer: string) => Promise<string>;
  onConnected?: () => void;
  /** "failed": it never connected or didn't come back; "closed": the call ended */
  onEnded?: (reason: "failed" | "closed", wasConnected: boolean) => void;
  onCaption?: (caption: RealtimeCaption) => void;
  onRemoteStream?: (stream: MediaStream) => void;
  graceMs?: number;
}

export interface RealtimeCall {
  pc: RTCPeerConnection;
  setMuted: (muted: boolean) => void;
  /** Ends our side of the call; onEnded isn't called */
  close: () => void;
}

export async function openRealtimeCall(o: RealtimeCallOptions): Promise<RealtimeCall> {
  if (typeof RTCPeerConnection === "undefined") throw new Error("This browser can't make voice calls.");
  const pc = new RTCPeerConnection();
  let connected = false;
  let done = false;
  let grace: ReturnType<typeof setTimeout> | null = null;

  const release = () => {
    if (grace) clearTimeout(grace);
    grace = null;
    pc.getSenders().forEach((s) => s.track?.stop());
    o.mic.getTracks().forEach((t) => t.stop());
    pc.close();
    if (o.audio) o.audio.srcObject = null;
  };
  const end = (reason: "failed" | "closed") => {
    if (done) return;
    done = true;
    release();
    o.onEnded?.(reason, connected);
  };

  o.mic.getTracks().forEach((t) => pc.addTrack(t, o.mic));
  pc.ontrack = (e) => {
    if (o.audio) {
      o.audio.srcObject = e.streams[0];
      void o.audio.play().catch(() => undefined);
    }
    o.onRemoteStream?.(e.streams[0]);
  };
  const dc = pc.createDataChannel("oai-events");
  dc.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data) as { type?: string; transcript?: string };
      const text = msg.transcript?.trim();
      if (!text) return;
      if (msg.type === "conversation.item.input_audio_transcription.completed") o.onCaption?.({ role: "student", text });
      else if (msg.type === "response.output_audio_transcript.done" || msg.type === "response.audio_transcript.done") o.onCaption?.({ role: "interviewer", text });
    } catch {
      // captions are optional
    }
  };
  pc.onconnectionstatechange = () => {
    if (done) return;
    const state = pc.connectionState;
    if (state === "connected") {
      if (grace) clearTimeout(grace);
      grace = null;
      if (!connected) {
        connected = true;
        o.onConnected?.();
      }
    } else if (state === "disconnected") {
      // Often a short network blip: wait before treating the call as over
      if (!grace) grace = setTimeout(() => pc.connectionState !== "connected" && end(connected ? "closed" : "failed"), o.graceMs ?? 8000);
    } else if (state === "failed") end("failed");
    else if (state === "closed") end("closed");
  };

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    const answer = await o.exchange(offer.sdp ?? "");
    await pc.setRemoteDescription({ type: "answer", sdp: answer });
  } catch (e) {
    done = true;
    release();
    throw e;
  }

  return {
    pc,
    setMuted: (muted) => o.mic.getAudioTracks().forEach((t) => (t.enabled = !muted)),
    close: () => {
      if (done) return;
      done = true;
      release();
    },
  };
}
