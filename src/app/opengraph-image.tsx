import { ImageResponse } from "next/og";

export const alt = "Bubble, la plateforme centrale des habitants de Terra Nova";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The card shown when a link to the platform is shared. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg, #0b0d12 0%, #131a2b 100%)", color: "#f5f0e8" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 28, height: 28, borderRadius: 999, background: "#f26a1b" }} />
          <div style={{ fontSize: 30, letterSpacing: 6, textTransform: "uppercase", color: "#f26a1b" }}>Terra Nova</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 148, fontWeight: 700, lineHeight: 1, color: "#f26a1b" }}>bubble</div>
          <div style={{ fontSize: 44, lineHeight: 1.2, maxWidth: 940 }}>La plateforme centrale des habitants : services, démarches, alertes, carte et vie de quartier.</div>
        </div>
      </div>
    ),
    size,
  );
}
