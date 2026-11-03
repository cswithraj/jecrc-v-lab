import type { Metadata } from "next";
// Self-hosted fonts (no runtime call to Google Fonts; works offline / behind campus proxies)
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/cormorant-garamond/700.css";
import { getInstitution } from "@/lib/settings";
import "./globals.css";


export async function generateMetadata(): Promise<Metadata> {
  const inst = await getInstitution();
  return { title: { default: inst.shortName, template: `%s · ${inst.shortName}` }, description: `${inst.platformName} — ${inst.tagline}` };
}

// Applies the saved theme before paint to avoid a flash of the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem('vlab-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
