import type { Metadata } from "next";
import { Lora, IBM_Plex_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const heading = Lora({ subsets: ["latin"], variable: "--font-heading" });
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-mono",
});
const body = Source_Serif_4({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Sensor Dashboard",
  description: "Live and historical readings from the ESP32 device",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${heading.variable} ${mono.variable} ${body.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}