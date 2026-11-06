import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HostelHub | Hostel operations",
  description: "A practical workspace for hostel rooms, allocations, and complaints.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
