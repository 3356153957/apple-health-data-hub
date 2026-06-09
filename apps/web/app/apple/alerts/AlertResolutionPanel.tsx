"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";

import { AppleCategoryIcon, type AppleIconName } from "../appleHealth";

export type HealthAlertTone = "good" | "warn" | "neutral";

export type HealthAlert = {
  id: string;
  title: string;
  body: string;
  href: string;
  icon: AppleIconName;
  tone: HealthAlertTone;
  meta: string;
  action: string;
  evidence: string[];
};

function storageKey(dateKey: string) {
  return `health-alerts:${dateKey}`;
}

export function AlertResolutionPanel({
  alerts,
  dateKey,
  compact = false,
}: {
  alerts: HealthAlert[];
  dateKey: string;
  compact?: boolean;
}) {
  const [resolved, setResolved] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(dateKey));
      setResolved(raw ? JSON.parse(raw) : {});
    } catch {
      setResolved({});
    } finally {
      setLoaded(true);
    }
  }, [dateKey]);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(storageKey(dateKey), JSON.stringify(resolved));
  }, [dateKey, loaded, resolved]);

  const totalActionable = alerts.filter((alert) => alert.tone === "warn").length || alerts.length;
  const resolvedCount = useMemo(
    () => alerts.filter((alert) => resolved[alert.id]).length,
    [alerts, resolved],
  );
  const progress = totalActionable ? Math.round((resolvedCount / totalActionable) * 100) : 100;

  function toggle(id: string) {
    setResolved((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <section className={`apple-alert-board ${compact ? "compact" : ""}`} aria-label="提醒处理面板">
      <div className="apple-alert-board-head">
        <div>
          <span>处理进度</span>
          <strong>{resolvedCount}/{totalActionable}</strong>
          <p>{resolvedCount ? "已处理的提醒会保留在这个设备上。" : "从最上面的提醒开始处理，避免只看不做。"}</p>
        </div>
        <div className="apple-alert-ring" style={{ "--alert-pct": `${progress}%` } as CSSProperties}>
          <i aria-hidden />
          <b>{progress}%</b>
        </div>
      </div>

      <div className="apple-alert-list">
        {alerts.map((alert) => {
          const isResolved = Boolean(resolved[alert.id]);
          return (
            <article className={`apple-alert-item ${alert.tone} ${isResolved ? "resolved" : ""}`} key={alert.id}>
              <button
                type="button"
                className="apple-alert-toggle"
                aria-pressed={isResolved}
                onClick={() => toggle(alert.id)}
              >
                <span aria-hidden>{isResolved ? "✓" : ""}</span>
              </button>
              <AppleCategoryIcon name={alert.icon} />
              <div className="apple-alert-main">
                <span>{isResolved ? "已处理" : alert.meta}</span>
                <strong>{alert.title}</strong>
                <p>{alert.body}</p>
                <div className="apple-alert-evidence">
                  {alert.evidence.map((item) => (
                    <em key={item}>{item}</em>
                  ))}
                </div>
                <div className="apple-alert-actions">
                  <button type="button" onClick={() => toggle(alert.id)}>
                    {isResolved ? "取消已处理" : "标记已处理"}
                  </button>
                  <Link href={alert.href}>{alert.action}</Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <div className="apple-alert-board-foot" aria-live="polite">
        {resolvedCount >= totalActionable
          ? "今天的提醒已经处理完。明天同步后会重新生成新的关注点。"
          : `还剩 ${Math.max(0, totalActionable - resolvedCount)} 条需要处理。`}
      </div>
    </section>
  );
}
