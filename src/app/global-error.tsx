"use client";

/**
 * Last-resort 500, used when the root layout itself fails. No providers or
 * stylesheet are available here, so the page is self-contained and in French
 * (the product language) with an English line.
 */
export default function GlobalError({ error, reset }: { readonly error: Error & { digest?: string }; readonly reset: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0b0d12", color: "#e7e9ee" }}>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <div style={{ maxWidth: 420 }}>
            <p style={{ fontFamily: "monospace", opacity: 0.6, margin: 0 }}>500</p>
            <h1 style={{ fontSize: 26, margin: "8px 0" }}>Le service est momentanément indisponible</h1>
            <p style={{ opacity: 0.75, lineHeight: 1.5 }}>
              Réessayez dans un instant. <br />
              <span lang="en">The service is temporarily unavailable — please try again.</span>
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 20 }}>
              <button type="button" onClick={reset} style={{ padding: "10px 16px", borderRadius: 10, border: 0, background: "#7c5cff", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                Réessayer
              </button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full reload is the point: the app shell itself failed */}
              <a href="/" style={{ padding: "10px 16px", borderRadius: 10, background: "#1c2030", color: "#e7e9ee", fontWeight: 600, textDecoration: "none" }}>
                Accueil
              </a>
            </div>
            {error.digest ? <p style={{ fontFamily: "monospace", fontSize: 11, opacity: 0.5, marginTop: 20 }}>ref : {error.digest}</p> : null}
          </div>
        </main>
      </body>
    </html>
  );
}
