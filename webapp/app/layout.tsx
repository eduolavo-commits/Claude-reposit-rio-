import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AGS.CLICK Treinamentos — Área do Aluno",
  description:
    "Plataforma de cursos AGS.CLICK. Assista, aprenda e emita seu certificado.",
  manifest: "/manifest.webmanifest",
  applicationName: "AGS.CLICK",
  appleWebApp: { capable: true, title: "AGS.CLICK", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0b0d12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js').catch(()=>{})})}`,
          }}
        />
      </body>
    </html>
  );
}
