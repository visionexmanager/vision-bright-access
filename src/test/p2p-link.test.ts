// The peer-to-peer link between two players: a handshake through a stand-in
// for the signalling row, then messages in both directions, with two fake
// peers wired to each other in place of the browser's WebRTC.

import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  MAX_MESSAGE_CHARS,
  P2PLink,
  parseP2PMessage,
  type ChannelLike,
  type P2PMessage,
  type P2PSignal,
  type PeerLike,
} from "@/systems/p2pLink";

class FakeChannel implements ChannelLike {
  readyState = "connecting";
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  other: FakeChannel | null = null;
  send(data: string) {
    if (this.readyState !== "open") throw new Error("not open");
    const other = this.other;
    queueMicrotask(() => other?.onmessage?.({ data }));
  }
  close() {
    if (this.readyState === "closed") return;
    this.readyState = "closed";
    this.onclose?.();
    const other = this.other;
    if (other && other.readyState !== "closed") queueMicrotask(() => other.close());
  }
  open() {
    this.readyState = "open";
    this.onopen?.();
  }
}

const registry = new Map<string, FakePeer>();
let counter = 0;

class FakePeer implements PeerLike {
  localDescription: { sdp?: string } | null = null;
  iceGatheringState = "complete";
  onicegatheringstatechange: (() => void) | null = null;
  ondatachannel: ((e: { channel: ChannelLike }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  connectionState = "new";
  channel: FakeChannel | null = null;
  id = `peer-${++counter}`;
  remote: FakePeer | null = null;
  constructor() {
    registry.set(this.id, this);
  }
  createDataChannel() {
    this.channel = new FakeChannel();
    return this.channel;
  }
  async createOffer() {
    return { type: "offer" as const, sdp: this.id };
  }
  async createAnswer() {
    return { type: "answer" as const, sdp: this.id };
  }
  async setLocalDescription(d: { sdp?: string }) {
    this.localDescription = { sdp: d.sdp };
  }
  async setRemoteDescription(d: { type: string; sdp: string }) {
    const other = registry.get(d.sdp);
    if (!other) throw new Error("unknown sdp");
    this.remote = other;
    if (d.type === "offer") {
      // The answering side receives the offerer's channel.
      const mine = new FakeChannel();
      const theirs = other.channel!;
      mine.other = theirs;
      theirs.other = mine;
      this.channel = mine;
      this.ondatachannel?.({ channel: mine });
    } else {
      // Answer applied on the offerer: both ends open.
      const theirs = other.channel!;
      queueMicrotask(() => {
        this.channel!.open();
        theirs.open();
      });
    }
  }
  close() {
    this.connectionState = "closed";
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));

function pair() {
  const row: { signal: P2PSignal | null } = { signal: null };
  const hostMessages: P2PMessage[] = [];
  const guestMessages: P2PMessage[] = [];
  const events: string[] = [];
  const host = new P2PLink({
    role: "offer",
    myId: "host",
    createPeer: () => new FakePeer(),
    publishSignal: async (s) => {
      row.signal = s;
      await tick();
      await guest.handleSignal(s);
    },
    onMessage: (m) => hostMessages.push(m),
    onOpenChange: (open) => events.push(`host:${open}`),
  });
  const guest: P2PLink = new P2PLink({
    role: "answer",
    myId: "guest",
    createPeer: () => new FakePeer(),
    publishSignal: async (s) => {
      row.signal = s;
      await host.handleSignal(s);
    },
    onMessage: (m) => guestMessages.push(m),
    onOpenChange: (open) => events.push(`guest:${open}`),
  });
  return { host, guest, hostMessages, guestMessages, events, row };
}

describe("the handshake", () => {
  it("opens a channel on both devices with one offer and one answer", async () => {
    const { host, guest, row } = pair();
    expect(host.open).toBe(false);
    await host.start();
    await tick();
    await tick();
    expect(host.open).toBe(true);
    expect(guest.open).toBe(true);
    expect(row.signal?.kind).toBe("answer");
  });

  it("carries moves in both directions", async () => {
    const { host, guest, hostMessages, guestMessages } = pair();
    await host.start();
    await tick();
    await tick();
    expect(host.send({ t: "move", seq: 1, state: { board: [1, 2] }, next: "guest" })).toBe(true);
    expect(guest.send({ t: "score", id: "guest", score: 7, fin: false })).toBe(true);
    await tick();
    expect(guestMessages).toEqual([{ t: "move", seq: 1, state: { board: [1, 2] }, next: "guest" }]);
    expect(hostMessages).toEqual([{ t: "score", id: "guest", score: 7, fin: false }]);
  });

  it("says the message did not go out until the channel is open, so the caller uses the server", () => {
    const { host } = pair();
    expect(host.send({ t: "move", seq: 1, state: {}, next: null })).toBe(false);
  });

  it("ignores its own signal and a second answer", async () => {
    const { host } = pair();
    await host.start();
    await tick();
    await tick();
    await expect(host.handleSignal({ from: "host", kind: "answer", sdp: "x", ts: 1 })).resolves.toBeUndefined();
    await expect(host.handleSignal({ from: "guest", kind: "answer", sdp: "peer-999", ts: 2 })).resolves.toBeUndefined();
    expect(host.open).toBe(true);
  });

  it("reports the drop once, to the side that was connected", async () => {
    const { host, guest, events } = pair();
    await host.start();
    await tick();
    await tick();
    host.close();
    await tick();
    await tick();
    expect(guest.open).toBe(false);
    expect(events.filter((e) => e === "guest:false")).toHaveLength(1);
    expect(host.send({ t: "move", seq: 2, state: {}, next: null })).toBe(false);
  });
});

describe("what arrives from the other device", () => {
  const good = JSON.stringify({ t: "move", seq: 3, state: { a: 1 }, next: "p2" });

  it("accepts a well-formed move and score", () => {
    expect(parseP2PMessage(good)).toEqual({ t: "move", seq: 3, state: { a: 1 }, next: "p2" });
    expect(parseP2PMessage(JSON.stringify({ t: "score", id: "p", score: 1.5, fin: true }))).not.toBeNull();
    expect(parseP2PMessage(JSON.stringify({ t: "move", seq: 1, state: {}, next: null }))).not.toBeNull();
  });

  it.each([
    ["not a string", { t: "move" }],
    ["not JSON", "{oops"],
    ["a list", "[1,2]"],
    ["unknown type", JSON.stringify({ t: "eval", code: "1" })],
    ["move without a sequence", JSON.stringify({ t: "move", state: {}, next: null })],
    ["a zero sequence", JSON.stringify({ t: "move", seq: 0, state: {}, next: null })],
    ["a fractional sequence", JSON.stringify({ t: "move", seq: 1.5, state: {}, next: null })],
    ["a state that is a list", JSON.stringify({ t: "move", seq: 1, state: [], next: null })],
    ["a numeric next player", JSON.stringify({ t: "move", seq: 1, state: {}, next: 5 })],
    ["a score that is not finite", '{"t":"score","id":"p","score":null,"fin":false}'],
    ["a score without fin", JSON.stringify({ t: "score", id: "p", score: 1 })],
  ])("refuses %s", (_name, raw) => {
    expect(parseP2PMessage(raw)).toBeNull();
  });

  it("refuses a message over the size cap without parsing it", () => {
    const big = JSON.stringify({ t: "move", seq: 1, state: { pad: "x".repeat(MAX_MESSAGE_CHARS) }, next: null });
    const parse = vi.spyOn(JSON, "parse");
    expect(parseP2PMessage(big)).toBeNull();
    expect(parse).not.toHaveBeenCalled();
    parse.mockRestore();
  });
});

describe("how the hook uses it", () => {
  const hook = readFileSync("src/hooks/useMultiplayer.ts", "utf8");
  const migration = readFileSync("supabase/migrations/20261100000000_game_sessions_p2p.sql", "utf8");

  it("tries the link first and falls back to the row", () => {
    const start = hook.indexOf("const makeMove");
    const body = hook.slice(start, hook.indexOf("// ── Update my score", start));
    expect(body.indexOf("linkRef.current?.send")).toBeGreaterThan(-1);
    expect(body.indexOf("linkRef.current?.send")).toBeLessThan(body.indexOf('.from("game_sessions")'));
  });

  it("never lets an older row rewind a newer local game", () => {
    expect(hook).toContain("(incoming.p2p_seq ?? 0) < seqRef.current");
  });

  it("sends final scores, the end of the game and the handshake to the row, never over the link", () => {
    expect(hook).toContain("!finished && linkRef.current?.send");
    const end = hook.slice(hook.indexOf("const endGame"), hook.indexOf("// ── Leave"));
    expect(end).not.toContain("linkRef");
    expect(end).toContain('status: "finished"');
  });

  it("adds the two columns under the existing participant-only policies", () => {
    expect(migration).toContain("rtc_signal jsonb");
    expect(migration).toContain("p2p_seq integer NOT NULL DEFAULT 0");
    expect(migration).not.toMatch(/CREATE POLICY|GRANT/i);
  });
});
