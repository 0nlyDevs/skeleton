"use client";

import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useTranslation } from "@/components/providers/i18n-provider";
import { UserAvatar } from "@/components/shell/user-avatar";
import { cn } from "@/lib/utils";

import { useCall } from "./call-provider";

function useElapsed(startedAt: number | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [startedAt]);
  if (!startedAt) return "";
  const seconds = Math.max(0, Math.floor((now - startedAt) / 1_000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function StreamVideo({ stream, muted, className }: { stream: MediaStream | null; muted?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted={muted} className={className} />;
}

function RoundButton({
  label,
  onClick,
  tone = "neutral",
  children,
}: {
  label: string;
  onClick: () => void;
  tone?: "neutral" | "danger" | "success" | "active";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid size-14 place-items-center rounded-full text-white transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
        tone === "danger" && "bg-destructive hover:bg-destructive/90",
        tone === "success" && "bg-success hover:bg-success/90",
        tone === "neutral" && "bg-white/15 hover:bg-white/25",
        tone === "active" && "bg-white text-black hover:bg-white/90",
      )}
    >
      {children}
    </button>
  );
}

export function CallOverlay() {
  const t = useTranslation();
  const { state, localStream, remoteStream, accept, decline, hangup, toggleMute, toggleCamera } = useCall();
  const elapsed = useElapsed(state.startedAt);
  const peer = state.peer;
  const video = state.kind === "video";
  const hasRemoteVideo = (remoteStream?.getVideoTracks().length ?? 0) > 0;

  const caption =
    state.phase === "incoming"
      ? t(video ? "call.incoming_video" : "call.incoming_audio")
      : state.phase === "outgoing"
        ? t("call.calling")
        : state.phase === "connecting"
          ? t("call.connecting")
          : elapsed;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={caption}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-neutral-950/95 px-4 py-10 text-white backdrop-blur-sm"
    >
      {/* Remote media: video fills the screen; audio plays through a hidden element. */}
      {video && hasRemoteVideo && state.phase === "active" ? (
        <StreamVideo stream={remoteStream} className="absolute inset-0 size-full object-cover" />
      ) : (
        <audio
          ref={(element) => {
            if (element && element.srcObject !== remoteStream) element.srcObject = remoteStream;
          }}
          autoPlay
        />
      )}

      <div className="relative z-10 flex flex-col items-center gap-3 pt-6 text-center">
        {peer ? (
          <span className={cn("rounded-full", (state.phase === "incoming" || state.phase === "outgoing") && "animate-pulse")}>
            <UserAvatar userId={peer.id} name={peer.name} image={peer.image} size="xl" />
          </span>
        ) : null}
        <h2 className="text-xl font-semibold drop-shadow">{peer?.name}</h2>
        <p className="text-sm tabular-nums text-white/75 drop-shadow" aria-live="polite">
          {caption}
        </p>
      </div>

      {video && localStream && state.phase !== "incoming" ? (
        <StreamVideo
          stream={localStream}
          muted
          className={cn(
            "absolute bottom-32 right-4 z-10 aspect-[3/4] w-28 rounded-xl border border-white/20 object-cover shadow-lg sm:w-40 [transform:scaleX(-1)]",
            state.cameraOff && "opacity-0",
          )}
        />
      ) : null}

      <div className="relative z-10 flex items-center gap-5">
        {state.phase === "incoming" ? (
          <>
            <RoundButton label={t("call.decline")} tone="danger" onClick={decline}>
              <PhoneOff className="size-6" />
            </RoundButton>
            <RoundButton label={t("call.accept")} tone="success" onClick={() => void accept()}>
              {video ? <Video className="size-6" /> : <Phone className="size-6" />}
            </RoundButton>
          </>
        ) : (
          <>
            <RoundButton label={t(state.muted ? "call.unmute" : "call.mute")} tone={state.muted ? "active" : "neutral"} onClick={toggleMute}>
              {state.muted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
            </RoundButton>
            {video ? (
              <RoundButton
                label={t(state.cameraOff ? "call.camera_on" : "call.camera_off")}
                tone={state.cameraOff ? "active" : "neutral"}
                onClick={toggleCamera}
              >
                {state.cameraOff ? <VideoOff className="size-6" /> : <Video className="size-6" />}
              </RoundButton>
            ) : null}
            <RoundButton label={t("call.hangup")} tone="danger" onClick={hangup}>
              <PhoneOff className="size-6" />
            </RoundButton>
          </>
        )}
      </div>
    </div>
  );
}
