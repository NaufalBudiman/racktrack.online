import type { Metadata, Viewport } from "next";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "RackTrack — inventory for network & IT engineers",
  description:
    "Free team inventory for network and IT engineers. See what's in stock and what's at a customer: switches, access points, routers, firewalls and servers, with loans, history and roles.",
  metadataBase: new URL("https://racktrack.online"),
};

export const viewport: Viewport = {
  themeColor: "#07090D",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-D7S3VY3ZSZ" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-D7S3VY3ZSZ');",
          }}
        />
      </head>
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  );
}
