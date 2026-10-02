"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useTranslation } from "@/components/providers/i18n-provider";
import { useSocket } from "@/hooks/use-socket";
import type { MessageKey } from "@/lib/i18n";
import {
  SOCKET_EVENTS,
  type CallAck,
  type CallEndedPayload,
  type CallIncomingPayload,
  type CallSignalPayload,
  type IceServerPayload,
} from "@/lib/socket/events";

import { CallOverlay } from "./call-overlay";
import { useRingtone } from "./use-ringtone";

export interface CallPeer {
  readonly id: string;
  readonly name: string;
  readonly image: string | null;
}

export type CallPhase = "idle" | "outgoing" | "incoming" | "connecting" | "active";

export interface CallState {
  readonly phase: CallPhase;
  readonly callId: string | null;
  readonly kind: "audio" | "video";
  readonly peer: CallPeer | null;
  readonly startedAt: number | null;
  readonly muted: boolean;
  readonly cameraOff: boolean;
}

interface CallContextValue {
  readonly state: CallState;
  readonly localStream: MediaStream | null;
  readonly remoteStream: MediaStream | null;
  startCall: (roomId: string, peer: CallPeer, kind: "audio" | "video") => Promise<void>;
  accept: () => Promise<void>;
  decline: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
}

const IDLE: CallState = { phase: "idle", callId: null, kind: "audio", peer: null, startedAt: null, muted: false, cameraOff: false };
const CallContext = createContext<CallContextValue | null>(null);

/**
 * One call at a time, anywhere in the app. Media is peer-to-peer (WebRTC,
 * DTLS-SRTP); the server only relays signalling between the two members of a
 * direct conversation and checks every frame against its call table.
 */
export function CallProvider({ children, viewerId }: { readonly children: React.ReactNode; readonly viewerId: string | null }) {
  const t = useTranslation();
  const { socket } = useSocket();
  const [state, setState] = useState<CallState>(IDLE);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const local = useRef<MediaStream | null>(null);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const incoming = useRef<CallIncomingPayload | null>(null);
  const callIdRef = useRef<string | null>(null);

  useRingtone(state.phase === "incoming" || state.phase === "outgoing");

  const cleanup = useCallback(() => {
    pc.current?.close();
    pc.current = null;
    local.current?.getTracks().forEach((track) => track.stop());
    local.current = null;
    pendingCandidates.current = [];
    incoming.current = null;
    callIdRef.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setState(IDLE);
  }, []);

  const media = useCallback(async (kind: "audio" | "video") => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: kind === "video" ? { width: 1280, height: 720 } : false });
    local.current = stream;
    setLocalStream(stream);
    return stream;
  }, []);

  const connection = useCallback(
    (iceServers: IceServerPayload[], callId: string, stream: MediaStream) => {
      const peer = new RTCPeerConnection({ iceServers: iceServers as RTCIceServer[] });
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      const remote = new MediaStream();
      setRemoteStream(remote);
      peer.ontrack = (event) => {
        event.streams[0]?.getTracks().forEach((track) => remote.addTrack(track));
        setRemoteStream(new MediaStream(remote.getTracks()));
      };
      peer.onicecandidate = (event) => {
        if (event.candidate) {
          socket?.emit(SOCKET_EVENTS.callSignal, { callId, data: { type: "candidate", candidate: event.candidate.toJSON() as never } });
        }
      };
      peer.onconnectionstatechange = () => {
        if (peer.connectionState === "connected") setState((current) => ({ ...current, phase: "active", startedAt: current.startedAt ?? Date.now() }));
        if (peer.connectionState === "failed") {
          socket?.emit(SOCKET_EVENTS.callHangup, callId);
          toast.error(t("call.ended.failed"));
          cleanup();
        }
      };
      pc.current = peer;
      return peer;
    },
    [socket, cleanup, t],
  );

  const startCall = useCallback(
    async (roomId: string, peer: CallPeer, kind: "audio" | "video") => {
      if (!socket?.connected || state.phase !== "idle") return;
      let stream: MediaStream;
      try {
        stream = await media(kind);
      } catch {
        toast.error(t("call.permission"));
        return;
      }
      setState({ ...IDLE, phase: "outgoing", kind, peer });
      socket.timeout(10_000).emit(SOCKET_EVENTS.callInvite, { roomId, kind }, (error: Error | null, ack: CallAck) => {
        if (error || !ack.ok) {
          const code = error ? "failed" : ack.ok ? "failed" : ack.code;
          toast.error(code === "BUSY" ? t("call.ended.busy") : code === "OFFLINE" ? t("call.offline") : error || ack.ok ? t("call.ended.failed") : ack.message);
          cleanup();
          return;
        }
        callIdRef.current = ack.callId;
        setState((current) => ({ ...current, callId: ack.callId }));
        connection(ack.iceServers, ack.callId, stream);
      });
    },
    [socket, state.phase, media, connection, cleanup, t],
  );

  const accept = useCallback(async () => {
    const call = incoming.current;
    if (!socket || !call) return;
    let stream: MediaStream;
    try {
      stream = await media(call.kind);
    } catch {
      toast.error(t("call.permission"));
      socket.emit(SOCKET_EVENTS.callDecline, call.callId);
      cleanup();
      return;
    }
    setState((current) => ({ ...current, phase: "connecting" }));
    socket.timeout(10_000).emit(SOCKET_EVENTS.callAccept, call.callId, (error: Error | null, ack: CallAck) => {
      if (error || !ack.ok) {
        cleanup();
        return;
      }
      connection(ack.iceServers, call.callId, stream);
    });
  }, [socket, media, connection, cleanup, t]);

  const decline = useCallback(() => {
    const id = incoming.current?.callId ?? callIdRef.current;
    if (id) socket?.emit(SOCKET_EVENTS.callDecline, id);
    cleanup();
  }, [socket, cleanup]);

  const hangup = useCallback(() => {
    if (callIdRef.current) socket?.emit(SOCKET_EVENTS.callHangup, callIdRef.current);
    cleanup();
  }, [socket, cleanup]);

  const toggleMute = useCallback(() => {
    const muted = !state.muted;
    local.current?.getAudioTracks().forEach((track) => (track.enabled = !muted));
    setState((current) => ({ ...current, muted }));
  }, [state.muted]);

  const toggleCamera = useCallback(() => {
    const cameraOff = !state.cameraOff;
    local.current?.getVideoTracks().forEach((track) => (track.enabled = !cameraOff));
    setState((current) => ({ ...current, cameraOff }));
  }, [state.cameraOff]);

  useEffect(() => {
    if (!socket || !viewerId) return;
    const onIncoming = (payload: CallIncomingPayload) => {
      if (callIdRef.current || incoming.current) {
        socket.emit(SOCKET_EVENTS.callDecline, payload.callId);
        return;
      }
      incoming.current = payload;
      callIdRef.current = payload.callId;
      setState({ ...IDLE, phase: "incoming", callId: payload.callId, kind: payload.kind, peer: payload.from });
    };
    const onAccepted = async ({ callId }: { callId: string }) => {
      const peer = pc.current;
      if (!peer || callId !== callIdRef.current) return;
      setState((current) => ({ ...current, phase: "connecting" }));
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit(SOCKET_EVENTS.callSignal, { callId, data: { type: "offer", sdp: offer.sdp ?? "" } });
    };
    const onSignal = async ({ callId, data }: CallSignalPayload) => {
      const peer = pc.current;
      if (!peer || callId !== callIdRef.current) return;
      if (data.type === "candidate") {
        if (peer.remoteDescription) await peer.addIceCandidate(data.candidate).catch(() => undefined);
        else pendingCandidates.current.push(data.candidate);
        return;
      }
      await peer.setRemoteDescription({ type: data.type, sdp: data.sdp });
      for (const candidate of pendingCandidates.current.splice(0)) await peer.addIceCandidate(candidate).catch(() => undefined);
      if (data.type === "offer") {
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        socket.emit(SOCKET_EVENTS.callSignal, { callId, data: { type: "answer", sdp: answer.sdp ?? "" } });
      }
    };
    const onEnded = ({ callId, reason }: CallEndedPayload) => {
      if (callId !== callIdRef.current) return;
      if (reason !== "hangup" || pc.current) toast(t(`call.ended.${reason}` as MessageKey));
      cleanup();
    };
    socket.on(SOCKET_EVENTS.callIncoming, onIncoming);
    socket.on(SOCKET_EVENTS.callAccepted, onAccepted);
    socket.on(SOCKET_EVENTS.callSignal, onSignal);
    socket.on(SOCKET_EVENTS.callEnded, onEnded);
    return () => {
      socket.off(SOCKET_EVENTS.callIncoming, onIncoming);
      socket.off(SOCKET_EVENTS.callAccepted, onAccepted);
      socket.off(SOCKET_EVENTS.callSignal, onSignal);
      socket.off(SOCKET_EVENTS.callEnded, onEnded);
    };
  }, [socket, viewerId, cleanup, t]);

  // Hang up cleanly when the tab closes.
  useEffect(() => {
    const onUnload = () => {
      if (callIdRef.current) socket?.emit(SOCKET_EVENTS.callHangup, callIdRef.current);
    };
    window.addEventListener("pagehide", onUnload);
    return () => window.removeEventListener("pagehide", onUnload);
  }, [socket]);

  return (
    <CallContext.Provider value={{ state, localStream, remoteStream, startCall, accept, decline, hangup, toggleMute, toggleCamera }}>
      {children}
      {state.phase !== "idle" ? <CallOverlay /> : null}
    </CallContext.Provider>
  );
}

export function useCall(): CallContextValue {
  const context = useContext(CallContext);
  if (!context) throw new Error("useCall must be used inside CallProvider.");
  return context;
}
