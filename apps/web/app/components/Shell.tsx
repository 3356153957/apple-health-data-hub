"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { MOBILE_NAV, NavIcon, Sidebar, isNavItemActive } from "./Sidebar";
import { Topbar } from "./Topbar";

function MobileTabs() {
  const pathname = usePathname();
  return (
    <nav className="mobile-tabs" aria-label="常用健康入口">
      {MOBILE_NAV.map((item) => {
        const active = isNavItemActive(item, pathname);
        return (
          <Link className={`mobile-tab ${active ? "active" : ""}`} href={item.href} key={item.href}>
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// Client shell so the sidebar can become a slide-over drawer on small screens.
// On desktop it's a normal fixed sidebar; the menu button + scrim are CSS-hidden.
export function Shell({
  provider,
  isLocal,
  synced,
  children,
}: {
  provider: string;
  isLocal: boolean;
  synced: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`app ${open ? "nav-open" : ""}`}>
      <Sidebar
        provider={provider}
        isLocal={isLocal}
        synced={synced}
        onNavigate={() => setOpen(false)}
      />
      <button
        type="button"
        className="nav-scrim"
        aria-label="Close navigation"
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
      />
      <div className="app-main">
        <Topbar
          provider={provider}
          isLocal={isLocal}
          synced={synced}
          onMenu={() => setOpen((v) => !v)}
        />
        <main className="content">{children}</main>
      </div>
      <MobileTabs />
    </div>
  );
}
