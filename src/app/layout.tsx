import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const inter = localFont({
  src: "../fonts/InterVariable.woff2",
  variable: "--font-inter",
  display: "swap",
});
const serif = localFont({
  src: [
    { path: "../fonts/SourceSerif4-Regular.otf", weight: "400" },
    { path: "../fonts/SourceSerif4-Semibold.otf", weight: "600" },
    { path: "../fonts/SourceSerif4-Bold.otf", weight: "700" },
  ],
  variable: "--font-serif",
  display: "swap",
});
const mono = localFont({
  src: [
    { path: "../fonts/JetBrainsMono-Regular.woff2", weight: "400" },
    { path: "../fonts/JetBrainsMono-Medium.woff2", weight: "500" },
    { path: "../fonts/JetBrainsMono-Bold.woff2", weight: "700" },
  ],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DealScout — acquisitions ledger",
  description: "Internal platform for finding and underwriting high-cash-flow rentals.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
