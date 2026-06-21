import type { Metadata } from "next";
import { Shippori_Mincho, Inter, JetBrains_Mono } from "next/font/google";
import { TanmatsuNav } from "@/components/TanmatsuNav";
import "./globals.css";

const mincho = Shippori_Mincho({
  variable: "--font-mincho-src",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter-src",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono-src",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tanmatsu 端末 — learn the terminal, one journey across Japan",
  description:
    "Five cities, forty levels, one real shell. Learn the terminal by using it — actual commands, actual scenarios, no videos. Tokyo to Hokkaido, via Kyoto, Osaka, and Kanazawa.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${mincho.variable} ${inter.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <TanmatsuNav />
        {children}
      </body>
    </html>
  );
}
