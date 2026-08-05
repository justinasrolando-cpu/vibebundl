import { ImageResponse } from "next/og";
import {
  BUNDLE_PRICE_USD,
  TOTAL_ORIGINAL_PRICE,
  TOOL_COUNT_LABEL,
} from "@/lib/tools";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `VibeBundl — ${TOOL_COUNT_LABEL} subscriptions, one bill`;

/**
 * The share card. Rendered at request time by Next's OG runtime, so the
 * numbers can never drift from the catalogue — the savings figure is
 * computed, not typed.
 *
 * Palette and layout are lifted from the live landing page rather than
 * invented here: near-black ground, the warm orange aura behind the hero,
 * off-white type, and the same single-colour bracket mark. A share card that
 * doesn't look like the site it links to costs trust at exactly the wrong
 * moment.
 *
 * Tokens mirrored from the site's dark theme (globals.css):
 *   --background #080808   --surface #111111
 *   --foreground #f6f6fa   --muted  #9c9caa    --muted-2 #7f7f8e
 *   --accent-2   #fb923c   --attribution #4ade80
 *   --border     rgba(255,255,255,0.07)
 *
 * Deliberately no web fonts: ImageResponse would need the binary over the
 * network (and Satori can't read the woff2 next/font ships), so this renders
 * in the system sans. It's the one place the brand face isn't Space Grotesk —
 * an intermittently broken card would cost more than the mismatch.
 */
export default function OpengraphImage() {
  const saved = Math.round(TOTAL_ORIGINAL_PRICE - BUNDLE_PRICE_USD);
  const replaces = Math.round(TOTAL_ORIGINAL_PRICE);

  const INK = "#f6f6fa";
  const MUTED = "#9c9caa";
  const MUTED_2 = "#7f7f8e";
  const RUST = "#fb923c";
  const GREEN = "#4ade80";
  const BORDER = "rgba(255,255,255,0.07)";
  const SURFACE = "#111111";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#080808",
          // The hero aura, same two warm lights as the site. Painted on the
          // root rather than in positioned children: Satori resolves radial
          // falloff against a child's own box, which renders as hard-edged
          // rectangles instead of light.
          backgroundImage:
            "radial-gradient(circle at 18% 34%, rgba(251,146,60,0.15), rgba(8,8,8,0) 58%)," +
            "radial-gradient(circle at 82% 26%, rgba(251,146,60,0.09), rgba(8,8,8,0) 55%)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
            padding: 64,
            color: INK,
          }}
        >
          {/* ---------- Wordmark + attribution ---------- */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
              <svg width="38" height="38" viewBox="0 0 32 32" fill="none">
                <rect
                  x="0.5"
                  y="0.5"
                  width="31"
                  height="31"
                  rx="7.5"
                  stroke={INK}
                  strokeOpacity="0.35"
                />
                <g stroke={INK} strokeWidth="2.1" strokeLinecap="round">
                  <path d="M10 8.5H8.6A1.6 1.6 0 0 0 7 10.1v11.8a1.6 1.6 0 0 0 1.6 1.6H10" />
                  <path d="M22 8.5h1.4A1.6 1.6 0 0 1 25 10.1v11.8a1.6 1.6 0 0 1-1.6 1.6H22" />
                  <path d="M13 11.8h5" />
                  <path d="M13 16h6" />
                  <path d="M13 20.2h4" />
                </g>
              </svg>
              <div
                style={{
                  display: "flex",
                  fontSize: 27,
                  fontWeight: 700,
                  letterSpacing: -0.5,
                }}
              >
                vibebundl
              </div>
            </div>

            {/* The credit back to the death list, in the site's chip style. */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                border: `1px solid ${BORDER}`,
                background: SURFACE,
                borderRadius: 999,
                padding: "9px 17px",
                fontSize: 19,
                color: MUTED,
              }}
            >
              <span style={{ color: GREEN }}>$</span>
              <span>built from the death list at canivibecodeit.com</span>
            </div>
          </div>

          {/* ---------- Headline ---------- */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                fontSize: 76,
                fontWeight: 700,
                letterSpacing: -2.4,
                lineHeight: 1.03,
              }}
            >
              <span style={{ color: RUST }}>{TOOL_COUNT_LABEL}</span>
              <span style={{ marginLeft: 20 }}>subscriptions you were</span>
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 76,
                fontWeight: 700,
                letterSpacing: -2.4,
                lineHeight: 1.03,
              }}
            >
              told you could vibecode away.
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 10,
                fontSize: 76,
                fontWeight: 700,
                letterSpacing: -2.4,
                lineHeight: 1.03,
                color: MUTED_2,
              }}
            >
              So we did.
            </div>
          </div>

          {/* ---------- The one number, with the receipt beside it ---------- */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: `1px solid ${BORDER}`,
              paddingTop: 28,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <span
                style={{
                  display: "flex",
                  fontSize: 18,
                  letterSpacing: 3,
                  color: MUTED_2,
                }}
              >
                YOU KEEP
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  border: `1px solid rgba(251,146,60,0.35)`,
                  background: "rgba(251,146,60,0.10)",
                  borderRadius: 12,
                  padding: "9px 21px",
                }}
              >
                <span style={{ fontSize: 52, fontWeight: 700, color: RUST }}>
                  ${saved}
                </span>
                <span style={{ fontSize: 25, color: RUST, marginLeft: 2 }}>
                  /mo
                </span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
              }}
            >
              <span style={{ display: "flex", fontSize: 21, color: MUTED_2 }}>
                ${replaces}/mo of SaaS
              </span>
              <span
                style={{
                  display: "flex",
                  fontSize: 21,
                  color: INK,
                  marginTop: 6,
                }}
              >
                for ${BUNDLE_PRICE_USD}/mo
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
