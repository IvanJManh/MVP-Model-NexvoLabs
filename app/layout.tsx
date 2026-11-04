import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Founder 2 | Field Sales Demo Portal & Vapi Voice AI",
  description: "Live Voice AI Demonstration platform for luxury hospitality and hotel sales.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}

