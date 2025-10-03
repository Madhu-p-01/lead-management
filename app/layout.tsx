import { ReactNode } from "react";
import "./globals.css";
import "react-datepicker/dist/react-datepicker.css";

export const metadata = {
  title: "Lead Manager",
  description: "Manage imported leads, track statuses, and organize follow-ups.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}