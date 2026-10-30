// ─── Peer-to-peer link for two-player games ─────────────────────────────────
//
// A WebRTC data channel between the two players' devices, so that moves travel
// directly from one phone or computer to the other instead of being written to
// the `game_sessions` row and broadcast back by Postgres.
//
// The server still does two small jobs: it carries the connection handshake
// (one offer, one answer, each a single row update, no trickle ICE) and it
// keeps a checkpoint of the game so a refresh or a dropped connection can
// continue. Everything else stays between the players.
//
// Nothing here knows about Supabase or React. The caller supplies how a signal
// is published and what to do with a message, and may supply the peer factory
// (the tests do).

export interface P2PSignal {
  from: string;
  kind: "offer" | "answer";
  sdp: string;
  ts: number;
}

export type P2PMessage =
  | { t: "move"; seq: number; state: Record<string, unknown>; next: string | null }
  | { t: "score"; id: string; score: number; fin: boolean };

/** The part of RTCDataChannel this module uses. */
export interface ChannelLike {
  readyState: string;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
  send(data: string): void;
  close(): void;
}

/** The part of RTCPeerConnection this module uses. */
export interface PeerLike {
  localDescription: { sdp?: string } | null;
  iceGatheringState: string;
  onicegatheringstatechange: (() => void) | null;
  ondatachannel: ((e: { channel: ChannelLike }) => void) | null;
  onconnectionstatechange: (() => void) | null;
  connectionState: string;
  createDataChannel(label: string, init?: { ordered?: boolean }): ChannelLike;
  createOffer(): Promise<{ type: "offer"; sdp?: string }>;
  createAnswer(): Promise<{ type: "answer"; sdp?: string }>;
  setLocalDescription(d: { type: "offer" | "answer"; sdp?: string }): Promise<void>;
  setRemoteDescription(d: { type: "offer" | "answer"; sdp: string }): Promise<void>;
  close(): void;
}

export const STUN_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
/** A message larger than this is refused rather than parsed. */
export const MAX_MESSAGE_CHARS = 64 * 1024;
/** How long to wait for candidates before publishing what we have. */
export const ICE_GATHER_TIMEOUT_MS = 4000;
/** How long a link may take to open before the caller falls back to the server. */
export const CONNECT_TIMEOUT_MS = 12000;

/** False where the browser has no WebRTC or the player has switched it off. */
export function p2pSupported(): boolean {
  try {
    if (typeof RTCPeerConnection === "undefined") return false;
    return localStorage.getItem("vx_p2p") !== "off";
  } catch {
    return typeof RTCPeerConnection !== "undefined";
  }
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** A message from the other device, or null if it is not one of ours. */
export function parseP2PMessage(raw: unknown): P2PMessage | null {
  if (typeof raw !== "string" || raw.length > MAX_MESSAGE_CHARS) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isPlainObject(value)) return null;
  if (value.t === "move") {
    const { seq, state, next } = value;
    if (typeof seq !== "number" || !Number.isSafeInteger(seq) || seq < 1) return null;
    if (!isPlainObject(state)) return null;
    if (next !== null && typeof next !== "string") return null;
    return { t: "move", seq, state, next: next as string | null };
  }
  if (value.t === "score") {
    const { id, score, fin } = value;
    if (typeof id !== "string" || typeof score !== "number" || !Number.isFinite(score)) return null;
    if (typeof fin !== "boolean") return null;
    return { t: "score", id, score, fin };
  }
  return null;
}

export interface P2POptions {
  /** The host offers, the guest answers. */
  role: "offer" | "answer";
  myId: string;
  publishSignal(signal: P2PSignal): Promise<void>;
  onMessage(message: P2PMessage): void;
  /** Called when the channel opens and again when it closes. */
  onOpenChange(open: boolean): void;
  createPeer?: () => PeerLike;
}

export class P2PLink {
  private peer: PeerLike | null = null;
  private channel: ChannelLike | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private wasOpen = false;
  private answered = false;

  constructor(private readonly options: P2POptions) {}

  get open(): boolean {
    return !this.closed && this.channel?.readyState === "open";
  }

  private makePeer(): PeerLike {
    const peer = this.options.createPeer
      ? this.options.createPeer()
      : (new RTCPeerConnection({ iceServers: STUN_SERVERS }) as unknown as PeerLike);
    peer.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(peer.connectionState)) this.reportClosed();
    };
    this.peer = peer;
    this.timer = setTimeout(() => {
      if (!this.open) this.close();
    }, CONNECT_TIMEOUT_MS);
    return peer;
  }

  private attach(channel: ChannelLike) {
    this.channel = channel;
    channel.onopen = () => {
      if (this.closed) return;
      this.wasOpen = true;
      if (this.timer) clearTimeout(this.timer);
      this.options.onOpenChange(true);
    };
    channel.onclose = () => this.reportClosed();
    channel.onmessage = (event) => {
      const message = parseP2PMessage(event.data);
      if (message) this.options.onMessage(message);
    };
    // The data channel may already be open when we attach (the answerer side).
    if (channel.readyState === "open") channel.onopen?.();
  }

  private reportClosed() {
    if (this.closed) return;
    const wasOpen = this.wasOpen;
    this.close();
    if (wasOpen) this.options.onOpenChange(false);
  }

  /** Waits until the peer has its candidates, or the timeout, then returns its SDP. */
  private async gathered(peer: PeerLike): Promise<string | null> {
    if (peer.iceGatheringState !== "complete") {
      await new Promise<void>((resolve) => {
        const done = () => {
          if (peer.iceGatheringState === "complete") {
            peer.onicegatheringstatechange = null;
            resolve();
          }
        };
        peer.onicegatheringstatechange = done;
        setTimeout(resolve, ICE_GATHER_TIMEOUT_MS);
      });
    }
    return peer.localDescription?.sdp ?? null;
  }

  /** The host starts here: open a channel, make an offer, publish it. */
  async start(): Promise<void> {
    if (this.options.role !== "offer" || this.peer || this.closed) return;
    const peer = this.makePeer();
    this.attach(peer.createDataChannel("moves", { ordered: true }));
    await peer.setLocalDescription(await peer.createOffer());
    const sdp = await this.gathered(peer);
    if (!sdp || this.closed) return this.close();
    await this.options.publishSignal({ from: this.options.myId, kind: "offer", sdp, ts: Date.now() });
  }

  /** Either side feeds the other's signal in here. */
  async handleSignal(signal: P2PSignal): Promise<void> {
    if (this.closed || signal.from === this.options.myId) return;
    if (typeof signal.sdp !== "string" || signal.sdp.length > MAX_MESSAGE_CHARS) return;

    if (this.options.role === "answer" && signal.kind === "offer" && !this.answered) {
      this.answered = true;
      const peer = this.makePeer();
      peer.ondatachannel = (event) => this.attach(event.channel);
      await peer.setRemoteDescription({ type: "offer", sdp: signal.sdp });
      await peer.setLocalDescription(await peer.createAnswer());
      const sdp = await this.gathered(peer);
      if (!sdp || this.closed) return this.close();
      await this.options.publishSignal({ from: this.options.myId, kind: "answer", sdp, ts: Date.now() });
    } else if (this.options.role === "offer" && signal.kind === "answer" && this.peer && !this.answered) {
      this.answered = true;
      await this.peer.setRemoteDescription({ type: "answer", sdp: signal.sdp });
    }
  }

  /** True if the message went out on the channel; false means "use the server". */
  send(message: P2PMessage): boolean {
    if (!this.open || !this.channel) return false;
    try {
      this.channel.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    try {
      this.channel?.close();
    } catch { /* already closed */ }
    try {
      this.peer?.close();
    } catch { /* already closed */ }
  }
}
