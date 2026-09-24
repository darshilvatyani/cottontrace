import type { Metadata, Viewport } from "next";
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "opsz"],
  style: ["normal", "italic"],
});

const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "CottonTrace — Seed-to-Cloth Traceability",
    template: "%s · CottonTrace",
  },
  description:
    "Blockchain-enabled traceability, IoT, AI and Digital Product Passports for the cotton textile value chain.",
};

export const viewport: Viewport = {
  themeColor: "#141b45",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${fraunces.variable} ${hanken.variable} ${jetbrains.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#fbf8f2",
              border: "1px solid #d9cfbd",
              color: "#1c1a16",
              fontFamily: "var(--font-hanken)",
            },
          }}
        />
      </body>
    </html>
  );
}
