import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PunkNet - Decentralized Encrypted Messenger",
  description:
    "Secure peer-to-peer messaging with end-to-end encryption, onion routing, and WebRTC. No central servers. No tracking.",
  keywords: [
    "encrypted messenger",
    "p2p",
    "decentralized",
    "webrtc",
    "onion routing",
    "privacy",
  ],
  authors: [{ name: "PunkNet" }],
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#030712",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-gray-950 text-white`}>
        {children}
      </body>
    </html>
  );
}
