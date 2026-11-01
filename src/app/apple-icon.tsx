import { ImageResponse } from "next/og";
import { markDataUri } from "@/lib/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// iOS home screen icon: the tiled mark, rendered to PNG at build time.
export default function AppleIcon() {
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={markDataUri({ size: 180, tile: true })} width={180} height={180} alt="" />,
    size,
  );
}
