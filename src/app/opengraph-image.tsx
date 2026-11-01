import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { markDataUri } from "@/lib/brand";

export const alt = "RackTrack: in stock or at a customer, never a guess";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const font = (weight: 400 | 600) =>
  readFile(join(process.cwd(), `node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-${weight}-normal.woff`));

// Link preview (WhatsApp, Slack, etc.), rendered at build time.
export default async function OgImage() {
  const [regular, semibold] = await Promise.all([font(400), font(600)]);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#07090D",
          backgroundImage: "radial-gradient(circle at 78% 18%, rgba(247,162,58,.45), rgba(7,9,13,0) 55%)",
          color: "#F1F4F8",
          fontFamily: "Plex Mono",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={markDataUri({ size: 88 })} width={88} height={88} alt="" />
          <div style={{ fontSize: 56, fontWeight: 600, letterSpacing: -1 }}>RackTrack</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 64, fontWeight: 600, lineHeight: 1.05, letterSpacing: -2 }}>
            In stock or at a customer.
          </div>
          <div style={{ fontSize: 64, fontWeight: 600, lineHeight: 1.05, letterSpacing: -2, color: "#F7A23A" }}>
            Never a guess again.
          </div>
          <div style={{ fontSize: 28, color: "#BAC3CF", marginTop: 12 }}>
            Free team inventory for network &amp; IT gear · racktrack.online
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Plex Mono", data: regular, weight: 400, style: "normal" },
        { name: "Plex Mono", data: semibold, weight: 600, style: "normal" },
      ],
    },
  );
}
