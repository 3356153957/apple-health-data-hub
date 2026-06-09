import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { Shell } from "./components/Shell";
import "./globals.css";
import { agoLabel, safePrivacy, safeReadiness } from "./lib/load";

const sans = Geist({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "健康 · Apple Watch 数据",
  description: "本地优先的 Apple Watch 健康数据分析。",
};

// The shell fetches the egress posture + freshness for the sidebar/topbar status.
// Best-effort: defaults keep the chrome sensible when the backend is unreachable.
export default async function RootLayout({ children }: { children: ReactNode }) {
  const [privacy, readiness] = await Promise.all([safePrivacy(), safeReadiness()]);
  const provider = privacy?.provider ?? "本地模型";
  const isLocal = privacy?.is_local ?? true;
  const synced = agoLabel(readiness?.last_ingested_at ?? readiness?.last_observation_at ?? null);

  return (
    <html lang="zh-CN" className={`${sans.variable} ${mono.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before paint so there's no light/dark flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');document.documentElement.dataset.theme=(t==='light'||t==='dark')?t:'dark';}catch(e){document.documentElement.dataset.theme='dark';}})();",
          }}
        />
      </head>
      <body>
        <Shell provider={provider} isLocal={isLocal} synced={synced}>
          {children}
        </Shell>
      </body>
    </html>
  );
}
