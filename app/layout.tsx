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
    <html lang="es" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('mybrain:sidebar')==='collapsed')document.documentElement.dataset.sidebar='collapsed'}catch(e){}",
          }}
        />
        <SyncUserProfile />
        {children}
      </body>
    </html>
  );
}
