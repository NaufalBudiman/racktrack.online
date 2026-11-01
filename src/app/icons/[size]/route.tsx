import { ImageResponse } from "next/og";
import { markDataUri } from "@/lib/brand";

const SIZES = [192, 512];

export const dynamicParams = false;
export const generateStaticParams = () => SIZES.map((s) => ({ size: `${s}.png` }));

// PNG app icons for the web manifest (/icons/192.png, /icons/512.png), built once.
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const n = Number((await params).size.replace(/\.png$/, ""));
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element
    <img src={markDataUri({ size: n, tile: true })} width={n} height={n} alt="" />,
    { width: n, height: n },
  );
}
