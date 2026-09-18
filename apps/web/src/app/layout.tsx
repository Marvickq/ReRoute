import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReLoop — Material Intelligence & Traceability",
  description: "AI-assisted material intelligence, safety routing and traceability for e-waste",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
