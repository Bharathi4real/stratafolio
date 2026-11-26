"use client";

/**
 * Last-resort screen when a root layout itself fails. It can't rely on the app's CSS or fonts,
 * so everything is inline and matches Ink & Ember by hand.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "grid",
          placeItems: "center",
          background: "#0b0b0d",
          color: "#f5f2eb",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "1.5rem",
        }}
      >
        <main style={{ maxWidth: "34rem" }}>
          <p
            style={{
              fontFamily: "ui-monospace, monospace",
              fontSize: ".75rem",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "#ff5a1f",
              margin: 0,
            }}
          >
            500 / Something broke
          </p>
          <h1 style={{ fontSize: "clamp(2.5rem, 8vw, 4rem)", lineHeight: 1, margin: ".6rem 0" }}>
            Lost the <span style={{ color: "#ff5a1f", fontWeight: 300 }}>signal.</span>
          </h1>
          <p style={{ color: "#a8a49b", lineHeight: 1.6 }}>
            The site couldn’t load. Please try again in a moment.
          </p>
          <div style={{ display: "flex", gap: ".75rem", marginTop: "1.5rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                height: "3rem",
                padding: "0 1.4rem",
                borderRadius: 99,
                border: 0,
                background: "#ff5a1f",
                color: "#0b0b0d",
                font: "inherit",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                height: "3rem",
                padding: "0 1.4rem",
                borderRadius: 99,
                border: "1px solid #2a2a31",
                color: "#f5f2eb",
                display: "inline-grid",
                placeItems: "center",
                textDecoration: "none",
              }}
            >
              Back home
            </a>
          </div>
          {error.digest ? (
            <p
              style={{
                marginTop: "2rem",
                fontFamily: "ui-monospace, monospace",
                fontSize: ".7rem",
                color: "#7a776f",
              }}
            >
              Reference {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
