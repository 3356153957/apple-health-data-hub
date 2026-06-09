"use client";

import { usePathname } from "next/navigation";

import { APPLE_METRICS, BROWSE_CATEGORIES, RAW_TABLES } from "../apple/appleHealth";
import { ThemeToggle } from "./ThemeToggle";

const TITLES: Record<string, { title: string; sub: string }> = {
  "/": { title: "健康概览", sub: "Apple Watch 与 iPhone 健康数据。" },
  "/apple": { title: "健康概览", sub: "运动、睡眠、恢复和同步状态。" },
  "/apple/coach": { title: "健康教练", sub: "每日建议、异常提醒和行动优先级。" },
  "/apple/daily": { title: "每日总结", sub: "昨日运动、睡眠和今天建议。" },
  "/apple/highlights": { title: "健康亮点", sub: "运动、睡眠、恢复和趋势重点。" },
  "/apple/checklist": { title: "健康清单", sub: "关键数据、同步和隐私检查。" },
  "/apple/calendar": { title: "健康日历", sub: "按日期回看运动、站立、睡眠和训练。" },
  "/apple/report": { title: "健康报告", sub: "本周运动、睡眠、恢复和建议。" },
  "/apple/favorites": { title: "收藏", sub: "每天优先查看的健康指标。" },
  "/apple/browse": { title: "浏览", sub: "按活动、睡眠、心脏和恢复查看。" },
  "/apple/trends": { title: "趋势", sub: "最近 30 天变化更明显的健康指标。" },
  "/apple/sources": { title: "设备与同步", sub: "查看 Apple Watch、iPhone 和同步状态。" },
  "/demo": { title: "演示数据", sub: "示例健康故事。" },
  "/experiments": { title: "计划", sub: "可尝试的健康习惯。" },
  "/evidence": { title: "发现", sub: "系统识别到的趋势和异常。" },
  "/data": { title: "数据", sub: "覆盖范围、更新时间和指标列表。" },
  "/privacy": { title: "隐私", sub: "哪些数据会离开本机。" },
};

function lastPathSegment(pathname: string): string {
  const segment = pathname.split("/").filter(Boolean).at(-1) ?? "";
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function titleForPath(pathname: string): { title: string; sub: string } {
  if (pathname.startsWith("/apple/days/")) return { title: "每日详情", sub: "按这一天查看活动、睡眠和训练。" };
  if (pathname.startsWith("/apple/sources")) return TITLES["/apple/sources"];
  if (pathname.startsWith("/apple/categories/data")) return { title: "设备与同步", sub: "查看 Apple Watch、iPhone 和同步状态。" };
  if (pathname.startsWith("/apple/categories/")) {
    const slug = lastPathSegment(pathname);
    const category = BROWSE_CATEGORIES.find((item) => item.slug === slug);
    return category ? { title: category.title, sub: category.subtitle } : { title: "健康分类", sub: "相关指标、趋势和记录。" };
  }
  if (pathname.startsWith("/apple/metrics/")) {
    const key = lastPathSegment(pathname);
    const metric = APPLE_METRICS.find((item) => item.slug === key || item.id === key);
    return metric ? { title: metric.label, sub: metric.note } : { title: "健康指标", sub: "最近趋势、范围和记录。" };
  }
  if (pathname.startsWith("/apple/raw/")) {
    const table = lastPathSegment(pathname);
    const raw = RAW_TABLES[table];
    return raw ? { title: raw.label, sub: raw.description } : { title: "记录详情", sub: "最近记录和来源。" };
  }
  return TITLES[pathname] ?? TITLES["/"];
}

function processingLabel(provider: string, isLocal: boolean): string {
  if (isLocal) return "仅自己可见";
  if (provider.toLowerCase() === "ollama") return "仅自己可见";
  return "云端摘要";
}

export function Topbar({
  provider,
  isLocal,
  synced,
  onMenu,
}: {
  provider: string;
  isLocal: boolean;
  synced: string;
  onMenu?: () => void;
}) {
  const pathname = usePathname();
  const { title, sub } = titleForPath(pathname);
  return (
    <header className="topbar">
      <button type="button" className="menu-btn" onClick={onMenu} aria-label="打开导航">
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
          <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
        </svg>
      </button>
      <div className="topbar-title">
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>
      <div className="topbar-status">
        <span className="pill mono">
          {processingLabel(provider, isLocal)}
        </span>
        <span className="pill mono">最近同步 {synced}</span>
        <ThemeToggle />
      </div>
    </header>
  );
}
