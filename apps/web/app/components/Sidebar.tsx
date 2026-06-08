"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const ICONS: Record<string, ReactNode> = {
  overview: (
    <>
      <rect x="2.5" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="2.5" width="4.5" height="4.5" rx="1" />
      <rect x="2.5" y="9" width="4.5" height="4.5" rx="1" />
      <rect x="9" y="9" width="4.5" height="4.5" rx="1" />
    </>
  ),
  experiments: (
    <>
      <path d="M6 2.5h4" />
      <path d="M6.5 2.5v3.5L3.5 12a1.2 1.2 0 0 0 1.1 1.8h6.8A1.2 1.2 0 0 0 12.5 12L9.5 6V2.5" />
      <path d="M5.2 9.5h5.6" />
    </>
  ),
  evidence: (
    <>
      <path d="M3 4h10" />
      <path d="M3 8h10" />
      <path d="M3 12h7" />
    </>
  ),
  data: (
    <>
      <ellipse cx="8" cy="4" rx="5" ry="2" />
      <path d="M3 4v8c0 1.1 2.2 2 5 2s5-.9 5-2V4" />
      <path d="M3 8c0 1.1 2.2 2 5 2s5-.9 5-2" />
    </>
  ),
  apple: (
    <>
      <path d="M8 13.5s-5-3-5-7a3 3 0 0 1 5-2.2A3 3 0 0 1 13 6.5c0 4-5 7-5 7z" />
      <path d="M4.2 8h2.2l1-2.2 1.5 4.2 1-2h1.9" />
    </>
  ),
  stand: (
    <>
      <path d="M8 2.5v11" />
      <path d="M5.5 5.5h5" />
      <path d="M4.5 13.5h7" />
      <path d="M6.5 8.5l-2.5 2" />
      <path d="M9.5 8.5l2.5 2" />
    </>
  ),
  breath: (
    <>
      <path d="M4 6.5c1.2-2.2 4.5-2.2 5.7-.1 1.4 2.5-.8 5.1-5.1 5.1" />
      <path d="M12 9.5h.9c2.6 0 3.8 2.9 2 4.7-1.2 1.2-3.1 1.2-4.3 0" />
      <path d="M3 14h5" />
    </>
  ),
  privacy: <path d="M8 2.2l4.5 1.8v3.6c0 2.8-1.9 4.7-4.5 5.6-2.6-.9-4.5-2.8-4.5-5.6V4z" />,
};

type NavItem = {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
  activePrefixes?: readonly string[];
};

const NAV: readonly NavItem[] = [
  { href: "/apple", label: "健康概览", icon: "apple", exact: true },
  { href: "/apple/browse", label: "浏览", icon: "overview" },
  { href: "/apple/metrics/stand-time", label: "站立时间", icon: "stand", activePrefixes: ["/apple/metrics/activity.stand_minutes"] },
  { href: "/apple/metrics/respiratory-rate", label: "呼吸次数", icon: "breath", activePrefixes: ["/apple/metrics/vital.respiratory_rate"] },
  { href: "/apple/categories/activity", label: "活动", icon: "overview" },
  { href: "/apple/categories/sleep", label: "睡眠", icon: "data" },
  { href: "/apple/categories/recovery", label: "恢复", icon: "evidence" },
  { href: "/apple/sources", label: "数据来源", icon: "experiments", activePrefixes: ["/apple/raw/", "/apple/categories/data"] },
  { href: "/privacy", label: "隐私设置", icon: "privacy" },
];

function NavIcon({ name }: { name: string }) {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {ICONS[name]}
    </svg>
  );
}

export function Sidebar({
  provider,
  isLocal,
  synced,
  onNavigate,
}: {
  provider: string;
  isLocal: boolean;
  synced: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden>
          ◆
        </span>
        <span className="brand-name">HealthSave</span>
        <span className="brand-sub">datahub</span>
      </div>

      <nav className="nav">
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href ||
              pathname.startsWith(`${item.href}/`) ||
              Boolean(item.activePrefixes?.some((prefix) => pathname.startsWith(prefix)));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${active ? "active" : ""}`}
              onClick={onNavigate}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-foot">
        <div className="status-line">
          <span className={`status-dot ${isLocal ? "" : "warn"}`} />
          {isLocal ? "本地" : "云端"} · {provider}
        </div>
        <div className="status-sub">同步 {synced}</div>
      </div>
    </aside>
  );
}
