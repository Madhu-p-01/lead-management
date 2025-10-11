import type { Metadata } from "next";
import { ReactNode } from "react";
import "./globals.css";
import "react-datepicker/dist/react-datepicker.css";
import { AuthProvider } from "./contexts/AuthContext";

export const metadata: Metadata = {
  title: "LeadFlow - Lead Management System",
  description:
    "Manage imported leads, track statuses, and organize follow-ups.",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
