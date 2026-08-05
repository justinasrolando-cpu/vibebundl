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
 * Designed for the timeline, not for this file: in a feed the card is ~500px
 * wide, so it carries exactly one number. The old version split attention
 * across three equal stats (replaces / you pay / you keep) which at thumbnail
 * size read as an unreadable row of grey. The savings figure is the whole
 * pitch, so it gets the box, the accent and the largest type on the canvas.
 *
 * No web fonts fetched here: ImageResponse would need the font binary over
 * the network, and a share card that intermittently fails to render is worse
 * than one in the system sans.
 */
export default function OpengraphImage() {
  const saved = Math.round(TOTAL_ORIGINAL_PRICE - BUNDLE_PRICE_USD);
  const replaces = Math.round(TOTAL_ORIGINAL_PRICE);

  const ACCENT = "#4ade80";
  const MUTED = "#8f8fa0";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#08080a",
          // Both glows live on the root background rather than in absolutely
          // positioned child divs. Satori renders `closest-side` against a
          // child's own box, so those children showed up as hard-edged
          // rectangles instead of soft light. Painting them here, with an
          // explicit circle and a transparent stop in the page colour, keeps
          // the falloff smooth across the whole canvas.
          backgroundImage:
            "radial-gradient(circle at 16% 112%, rgba(74,222,128,0.22), rgba(8,8,10,0) 52%)," +
            "radial-gradient(circle at 94% -14%, rgba(45,212,191,0.14), rgba(8,8,10,0) 48%)",
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
            color: "#f7f7f8",
          }}
        >
          {/* ---------- Wordmark ---------- */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
              <rect
                x="0.5"
                y="0.5"
                width="31"
                height="31"
                rx="7.5"
                stroke={ACCENT}
                strokeOpacity="0.55"
              />
              <g stroke={ACCENT} strokeWidth="2.1" strokeLinecap="round">
                <path d="M10 8.5H8.6A1.6 1.6 0 0 0 7 10.1v11.8a1.6 1.6 0 0 0 1.6 1.6H10" />
                <path d="M22 8.5h1.4A1.6 1.6 0 0 1 25 10.1v11.8a1.6 1.6 0 0 1-1.6 1.6H22" />
              </g>
              <g stroke="#f7f7f8" strokeWidth="2.1" strokeLinecap="round">
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
              <span>vibe</span>
              <span style={{ color: ACCENT }}>bundl</span>
            </div>
          </div>

          {/* ---------- Headline ---------- */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                fontSize: 86,
                fontWeight: 700,
                letterSpacing: -3,
                lineHeight: 1.02,
              }}
            >
              <span style={{ color: ACCENT }}>{TOOLS.length}</span>
              <span style={{ marginLeft: 22 }}>subscriptions,</span>
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 86,
                fontWeight: 700,
                letterSpacing: -3,
                lineHeight: 1.02,
                color: MUTED,
              }}
            >
              one bill.
            </div>

            <div
              style={{
                display: "flex",
                marginTop: 22,
                fontSize: 27,
                color: MUTED,
              }}
            >
              Everything the internet said you could vibecode away — actually built.
            </div>
          </div>

          {/* ---------- The one number, plus the receipt beside it ---------- */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "1px solid rgba(255,255,255,0.09)",
              paddingTop: 30,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
              <span
                style={{
                  display: "flex",
                  fontSize: 19,
                  letterSpacing: 3,
                  color: MUTED,
                }}
              >
                YOU KEEP
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  border: `1px solid rgba(74,222,128,0.45)`,
                  background: "rgba(74,222,128,0.10)",
                  borderRadius: 12,
                  padding: "10px 22px",
                }}
              >
                <span style={{ fontSize: 54, fontWeight: 700, color: ACCENT }}>
                  ${saved}
                </span>
                <span style={{ fontSize: 26, color: ACCENT, marginLeft: 2 }}>/mo</span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
              }}
            >
              <span style={{ display: "flex", fontSize: 22, color: MUTED }}>
                ${replaces}/mo of SaaS
              </span>
              <span
                style={{
                  display: "flex",
                  fontSize: 22,
                  color: "#f7f7f8",
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
