import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { staticTopo } from "./topo";

export const ogSize = { width: 1200, height: 630 };

/**
 * Google's Article guidelines ask for images in 16:9, 4:3 and 1:1 (each ≥ 50K pixels); these
 * feed BlogPosting.image. The 1200×630 share card stays the og:image.
 */
export const articleSizes = {
  "16x9": { width: 1200, height: 675 },
  "4x3": { width: 1200, height: 900 },
  "1x1": { width: 1200, height: 1200 },
} as const;
export type ArticleRatio = keyof typeof articleSizes;

const font = (f: string) => readFile(path.join(process.cwd(), "assets/og", f));

/** Ink background, static contour art, ember accent, Bricolage title, Bharathi4real mark. 1200×630. */
export async function ogImage({
  kicker,
  title,
  accent,
  footer,
  size = ogSize,
}: {
  kicker: string;
  title: string;
  accent?: string;
  footer: string;
  size?: { width: number; height: number };
}) {
  const { width: w, height: h } = size;
  const [bold, light, mono] = await Promise.all([
    font("bricolage-grotesque-latin-700-normal.woff"),
    font("bricolage-grotesque-latin-300-normal.woff"),
    font("martian-mono-latin-400-normal.woff"),
  ]);
  const paths = staticTopo(`og-${title}`, w - 120, h - 70, 18, 30, w, h);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background:
          "radial-gradient(70% 90% at 100% 100%, rgba(255,90,31,0.38), rgba(11,11,13,0) 60%), #0b0b0d",
        color: "#f5f2eb",
        position: "relative",
      }}
    >
      <svg
        aria-hidden="true"
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        {paths.map((p) => (
          <path
            key={p.d.slice(0, 20)}
            d={p.d}
            fill="none"
            stroke="#ff5a1f"
            strokeWidth="1"
            opacity={p.opacity * 0.45}
          />
        ))}
      </svg>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          fontFamily: "Martian",
          fontSize: 20,
          letterSpacing: 3,
          textTransform: "uppercase",
          color: "#a8a49b",
        }}
      >
        <div style={{ width: 12, height: 12, borderRadius: 12, background: "#ff5a1f" }} />
        {kicker}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontFamily: "Bricolage",
          fontSize: title.length > 40 ? 76 : 96,
          lineHeight: 0.95,
          letterSpacing: -2,
          maxWidth: 1000,
        }}
      >
        <span style={{ fontWeight: 700 }}>{title}</span>
        {accent ? <span style={{ fontWeight: 300, color: "#ff5a1f" }}>{accent}</span> : null}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <span style={{ fontFamily: "Bricolage", fontWeight: 700, fontSize: 40, letterSpacing: -1 }}>
          Bharathi4real<span style={{ color: "#ff5a1f" }}>.</span>
        </span>
        <span
          style={{
            fontFamily: "Martian",
            fontSize: 18,
            color: "#7a776f",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          {footer}
        </span>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Bricolage", data: bold, weight: 700, style: "normal" },
        { name: "Bricolage", data: light, weight: 300, style: "normal" },
        { name: "Martian", data: mono, weight: 400, style: "normal" },
      ],
    },
  );
}

/** An uploaded picture (Settings → SEO → Share image), cropped to fill the 1200×630 card. */
export function ogPhoto(src: string) {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#0b0b0d" }}>
      {/* biome-ignore lint/performance/noImgElement: rendered by Satori, not the browser */}
      <img
        src={src}
        alt=""
        width={ogSize.width}
        height={ogSize.height}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>,
    ogSize,
  );
}
