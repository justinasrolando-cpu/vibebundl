import { ImageResponse } from "next/og";
import { TOOLS, BUNDLE_PRICE_USD, TOTAL_ORIGINAL_PRICE } from "@/lib/tools";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `VibeBundl — ${TOOLS.length} subscriptions, one bill`;

/**
 * The share card. Rendered at request time by Next's OG runtime, so the
 * numbers can never drift from the catalogue — the tool count and the
 * savings are computed, not typed.
 *
 * No web fonts fetched here: ImageResponse would need the font binary
 * over the network, and a share card that intermittently fails to render
 * is worse than one in the system sans.
 */
export default function OpengraphImage() {
  const saved = Math.round(TOTAL_ORIGINAL_PRICE - BUNDLE_PRICE_USD);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#08090a",
          padding: 72,
          color: "#f6f6fa",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="44" height="44" viewBox="0 0 32 32" fill="none">
            <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" stroke="#fafafa" strokeOpacity="0.4" />
            <g stroke="#fafafa" strokeWidth="2.1" strokeLinecap="round">
              <path d="M10 8.5H8.6A1.6 1.6 0 0 0 7 10.1v11.8a1.6 1.6 0 0 0 1.6 1.6H10" />
              <path d="M22 8.5h1.4A1.6 1.6 0 0 1 25 10.1v11.8a1.6 1.6 0 0 1-1.6 1.6H22" />
              <path d="M13 11.8h5" />
              <path d="M13 16h6" />
              <path d="M13 20.2h4" />
            </g>
          </svg>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, letterSpacing: -0.6 }}>
            <span>vibe</span>
            <span style={{ color: "#fafafa" }}>bundl</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 82, fontWeight: 700, letterSpacing: -2.4, lineHeight: 1.05 }}>
            <span style={{ color: "#fafafa" }}>{TOOLS.length}</span>
            <span style={{ marginLeft: 20 }}>subscriptions, one bill.</span>
          </div>
          <div style={{ display: "flex", marginTop: 18, fontSize: 30, color: "#9c9caa" }}>
            Everything the internet said you could vibecode away — actually built.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 56, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 28 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 20, color: "#7f7f8e", letterSpacing: 2 }}>REPLACES</span>
            <span style={{ fontSize: 42, fontWeight: 700, textDecoration: "line-through", color: "#9c9caa" }}>
              ${Math.round(TOTAL_ORIGINAL_PRICE)}/mo
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 20, color: "#7f7f8e", letterSpacing: 2 }}>YOU PAY</span>
            <span style={{ fontSize: 42, fontWeight: 700, color: "#fafafa" }}>${BUNDLE_PRICE_USD}/mo</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 20, color: "#7f7f8e", letterSpacing: 2 }}>YOU KEEP</span>
            <span style={{ fontSize: 42, fontWeight: 700 }}>${saved}/mo</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
