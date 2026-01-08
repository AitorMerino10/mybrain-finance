import type { Metadata } from "next";
import "./globals.css";
import { SyncUserProfile } from "@/components/sync-user-profile";

export const metadata: Metadata = {
  title: "MyBrain finance",
  description: "Gestión inteligente de finanzas personales y familiares",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">
        <SyncUserProfile />
        {children}
      </body>
    </html>
  );
}
