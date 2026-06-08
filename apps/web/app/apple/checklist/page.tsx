import Link from "next/link";
import type { Metadata } from "next";

import type { AppleDailySummary, AppleStatus, Privacy } from "../../lib/api";
import { safeAppleDailySummary, safeAppleStatus, safePrivacy, safeReadiness } from "../../lib/load";
import { AppleCategoryIcon, type AppleIconName, formatHours, formatValue, relativeZh, zhTime } from "../appleHealth";

export const metadata: Metadata = { title: "健康清单 · 健康" };
export const dynamic = "force-dynamic";

type ChecklistItem = {
  title: string;
  body: string;
  href: string;
  icon: AppleIconName;
  tone: "good" | "warn" | "neutral";
  status: string;
  value: string;
  action: string;
};

function totalRows(status: AppleStatus | null): number {
  return Object.values(status ?? {}).reduce((sum, row) => sum + (row.count ?? 0), 0);
}

function newest(values: Array<string | null | undefined>): string | null {
  return (
    values
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null
  );
}

function latestSync(status: AppleStatus | null): string | null {
  return newest(Object.values(status ?? {}).map((row) => row.newest));
}

function recentTone(iso: string | null): "good" | "warn" | "neutral" {
  if (!iso) return "warn";
  const hours = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (hours <= 24) return "good";
  if (hours <= 96) return "neutral";
  return "warn";
}

function privacyLabel(privacy: Privacy | null): string {
  if (!privacy) return "本地优先";
  if (privacy.raw_observations_leave_host) return "需要核对";
  return privacy.cloud_active ? "云端摘要" : "仅自己可见";
}

function privacyTone(privacy: Privacy | null): "good" | "warn" | "neutral" {
  if (!privacy) return "neutral";
  if (privacy.raw_observations_leave_host) return "warn";
  return "good";
}

function providerLabel(provider: string | null | undefined): string {
  if (!provider) return "仅自己可见";
  if (provider.toLowerCase() === "ollama") return "仅自己可见";
  return provider;
}

function rowCount(status: AppleStatus | null, table: string): number {
  return status?.[table]?.count ?? 0;
}

function rowNewest(status: AppleStatus | null, table: string): string | null {
  return status?.[table]?.newest ?? null;
}

function healthItems(summary: AppleDailySummary | null, status: AppleStatus | null, privacy: Privacy | null): ChecklistItem[] {
  const activityCount = rowCount(status, "daily_activity");
  const sleepCount = rowCount(status, "sleep_sessions");
  const heartCount = rowCount(status, "heart_rate") + rowCount(status, "hrv") + rowCount(status, "blood_oxygen");
  const bodyCount = rowCount(status, "quantity_samples");
  const newestSync = latestSync(status);
  const activityReady = activityCount > 0 && Boolean(summary?.activity);
  const sleepReady = sleepCount > 0 && Boolean(summary?.sleep);
  const heartReady = heartCount > 0 || bodyCount > 0;
  const summaryReady = Boolean(summary?.activity || summary?.sleep);

  return [
    {
      title: "活动记录",
      body: summary?.activity
        ? `最近摘要里已有 ${formatValue(summary.activity.steps)} 步、${formatValue(summary.activity.active_minutes)} 分钟活动和 ${formatHours(summary.activity.stand_minutes)} 站立。`
        : "还没有形成最近的活动摘要，先确认 Apple Watch 是否继续同步活动数据。",
      href: "/apple/categories/activity",
      icon: "activity",
      tone: activityReady ? "good" : activityCount ? "neutral" : "warn",
      status: activityReady ? "已就绪" : activityCount ? "有记录" : "需同步",
      value: `${activityCount.toLocaleString("zh-CN")} 条`,
      action: "查看活动",
    },
    {
      title: "睡眠记录",
      body: summary?.sleep
        ? `最近摘要里已有 ${formatHours(summary.sleep.total_sleep_min)} 睡眠、${formatValue(summary.sleep.efficiency_pct, 1)}% 效率和呼吸次数。`
        : "还没有形成最近的睡眠摘要；如果 Apple Watch 夜间未佩戴，也会缺少这部分记录。",
      href: "/apple/categories/sleep",
      icon: "sleep",
      tone: sleepReady ? "good" : sleepCount ? "neutral" : "warn",
      status: sleepReady ? "已就绪" : sleepCount ? "有记录" : "需同步",
      value: `${sleepCount.toLocaleString("zh-CN")} 条`,
      action: "查看睡眠",
    },
    {
      title: "心脏与恢复",
      body: heartReady
        ? `心率、HRV、血氧或其他身体指标已经同步，可用于查看恢复和近期趋势。`
        : "还没有看到心率或恢复类记录，先确认手表和健康权限是否正常。",
      href: "/apple/categories/recovery",
      icon: "recovery",
      tone: heartReady ? "good" : "warn",
      status: heartReady ? "已就绪" : "需同步",
      value: `${(heartCount + bodyCount).toLocaleString("zh-CN")} 条`,
      action: "查看恢复",
    },
    {
      title: "每日摘要",
      body: summaryReady
        ? `${summary?.date ?? "最近一天"} 已生成运动、睡眠和建议摘要。`
        : "还没有足够记录生成每日摘要，数据补齐后会自动出现在健康概览。",
      href: summary?.date ? `/apple/days/${encodeURIComponent(summary.date)}` : "/apple",
      icon: "data",
      tone: summaryReady ? "good" : "neutral",
      status: summaryReady ? "已生成" : "等待数据",
      value: summary?.date ?? "暂无",
      action: "查看摘要",
    },
    {
      title: "同步新鲜度",
      body: newestSync ? `最近同步 ${relativeZh(newestSync)}，时间是 ${zhTime(newestSync)}。` : "还没有看到 Apple 健康同步记录。",
      href: "/apple/sources",
      icon: "data",
      tone: recentTone(newestSync),
      status: newestSync ? relativeZh(newestSync).replace("同步", "") : "需同步",
      value: `${totalRows(status).toLocaleString("zh-CN")} 条`,
      action: "查看来源",
    },
    {
      title: "隐私状态",
      body: privacy?.raw_observations_leave_host
        ? "检测到健康明细可能离开本机，建议进入隐私设置核对。"
        : privacy?.cloud_active
          ? "当前可能使用云端摘要能力，但健康明细不会直接离开本机。"
          : "当前读取和分析在本机完成，健康明细保留在你的私密记录里。",
      href: "/privacy",
      icon: "body",
      tone: privacyTone(privacy),
      status: privacyLabel(privacy),
      value: providerLabel(privacy?.provider),
      action: "隐私设置",
    },
  ];
}

export default async function AppleChecklistPage() {
  const [summary, status, privacy, readiness] = await Promise.all([
    safeAppleDailySummary(),
    safeAppleStatus(),
    safePrivacy(),
    safeReadiness(),
  ]);
  const items = healthItems(summary, status, privacy);
  const done = items.filter((item) => item.tone === "good").length;
  const attention = items.filter((item) => item.tone === "warn").length;
  const latest = latestSync(status);

  return (
    <>
      <section className="apple-detail-hero">
        <div>
          <Link href="/apple" className="apple-back-link">
            返回健康概览
          </Link>
          <div className="hero-eyebrow">健康清单</div>
          <h2>关键项目检查</h2>
          <p>确认 Apple Watch、iPhone、活动、睡眠、恢复、同步和隐私状态是否准备好。</p>
        </div>
        <div className="apple-hero-badges">
          <span className="apple-badge">{items.length} 项检查</span>
          <span className="apple-badge good">{relativeZh(latest)}</span>
        </div>
      </section>

      <section className="apple-kpis">
        <div className="apple-kpi">
          <span>已就绪</span>
          <strong className="good">{done}</strong>
          <small>可以直接查看或分析</small>
        </div>
        <div className="apple-kpi">
          <span>需关注</span>
          <strong className={attention ? "warn" : "neutral"}>{attention}</strong>
          <small>建议优先核对</small>
        </div>
        <div className="apple-kpi">
          <span>记录类别</span>
          <strong>{Object.keys(status ?? {}).length}</strong>
          <small>{totalRows(status).toLocaleString("zh-CN")} 条同步记录</small>
        </div>
        <div className="apple-kpi">
          <span>来源</span>
          <strong>{readiness?.sources.length ?? 0}</strong>
          <small>本机可见同步来源</small>
        </div>
      </section>

      <section className="apple-panel apple-checklist-panel">
        <div className="apple-panel-head">
          <div>
            <h3>清单项目</h3>
            <p>每一项都可以点进去查看对应详情。</p>
          </div>
        </div>
        <div className="apple-checklist-grid">
          {items.map((item) => (
            <Link className={`apple-checklist-card ${item.tone}`} href={item.href} key={item.title}>
              <div className="apple-checklist-top">
                <AppleCategoryIcon name={item.icon} />
                <em>{item.status}</em>
              </div>
              <span>{item.title}</span>
              <strong>{item.value}</strong>
              <p>{item.body}</p>
              <small>{item.action}</small>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
