import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SyncUserProfile } from "@/components/sync-user-profile";
import PwaRegister from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "MyBrain finance",
  description: "Gestión inteligente de finanzas personales y familiares",
  applicationName: "MyBrain finance",
  appleWebApp: { capable: true, title: "MyBrain", statusBarStyle: "black" },
  icons: { icon: "/pwa-icon/192", apple: "/pwa-icon/180" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#071A2B",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('mybrain:sidebar')==='collapsed')document.documentElement.dataset.sidebar='collapsed'}catch(e){}",
          }}
        />
        <SyncUserProfile />
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
