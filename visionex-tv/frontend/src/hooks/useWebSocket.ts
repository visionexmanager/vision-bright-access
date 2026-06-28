"use client";
import { useEffect, useRef, useCallback } from "react";
import { getTvSocket, type StreamStatusEvent, type StreamSwitchedEvent } from "@/lib/websocket";
import { useAuthStore } from "@/store/auth.store";
import { usePlayerStore } from "@/store/player.store";
import { stream as streamApi } from "@/lib/api";

export function useTvWebSocket() {
  const accessToken = useAuthStore(s => s.accessToken);
  const { session, setStatus, setSession, channel } = usePlayerStore();
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    const socket = getTvSocket(accessToken ?? undefined);

    // Stream switched → update player URL
    const onSwitched = (data: StreamSwitchedEvent) => {
      if (!mountedRef.current) return;
      if (data.channelId !== channel?.id) return;

      // Player will receive the new URL via session update
      setSession({
        token:     session?.token ?? "",
        sourceId:  data.newSourceId,
        url:       data.url,
        type:      data.type,
        quality:   "HD",
        expiresAt: "",
        channelId: data.channelId,
      });
      setStatus("loading");
    };

    // Stream health update
    const onHealthUpdate = (data: StreamStatusEvent) => {
      if (!mountedRef.current) return;
      if (data.channelId !== channel?.id) return;
      if (data.score < 20) setStatus("buffering");
    };

    socket.on("stream.switched",      onSwitched);
    socket.on("stream.status.update", onHealthUpdate);

    return () => {
      socket.off("stream.switched",      onSwitched);
      socket.off("stream.status.update", onHealthUpdate);
    };
  }, [accessToken, channel?.id, session?.token, setSession, setStatus]);
}

export function useStreamFailover() {
  const accessToken = useAuthStore(s => s.accessToken);
  const { session } = usePlayerStore();

  const reportError = useCallback(async (sourceId: string) => {
    if (!session || !accessToken) return;
    try {
      const result = await streamApi.switch(session.token, sourceId, accessToken);
      return result;
    } catch {
      return null;
    }
  }, [session, accessToken]);

  return { reportError };
}
