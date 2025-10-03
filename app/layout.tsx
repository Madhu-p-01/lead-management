import { ReactNode } from "react";
import "./globals.css";
import "react-datepicker/dist/react-datepicker.css";
import { AuthProvider } from "./contexts/AuthContext";

export const metadata = {
  title: "Lead Manager",
  description:
    "Manage imported leads, track statuses, and organize follow-ups.",
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
