"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";

import { AppleCategoryIcon, type AppleIconName } from "../appleHealth";

type CoachAction = {
  id: string;
  title: string;
  body: string;
  href: string;
  icon: AppleIconName;
  tone: "good" | "warn" | "neutral";
  meta: string;
};

function storageKey(dateKey: string) {
  return `health-coach-actions:${dateKey}`;
}

export function CoachActionChecklist({
  actions,
  dateKey,
}: {
  actions: CoachAction[];
  dateKey: string;
}) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey(dateKey));
      setChecked(raw ? JSON.parse(raw) : {});
    } catch {
      setChecked({});
    } finally {
      setLoaded(true);
    }
  }, [dateKey]);

  useEffect(() => {
    if (!loaded) return;
    window.localStorage.setItem(storageKey(dateKey), JSON.stringify(checked));
  }, [checked, dateKey, loaded]);

  const completed = useMemo(
    () => actions.filter((action) => checked[action.id]).length,
    [actions, checked],
  );
  const total = actions.length || 1;
  const progress = Math.round((completed / total) * 100);
  const done = completed === actions.length && actions.length > 0;

  function toggle(actionId: string) {
    setChecked((current) => ({ ...current, [actionId]: !current[actionId] }));
  }

  function reset() {
    setChecked({});
  }

  return (
    <section className={`apple-panel health-coach-loop-panel ${done ? "complete" : ""}`} aria-label="今日行动闭环">
      <div className="health-coach-loop-head">
        <div>
          <span>今日行动闭环</span>
          <strong>{done ? "今天的关键动作已完成" : "看完建议后，把行动勾掉"}</strong>
          <p>勾选状态仅自己可见，用来帮助你确认今天是否真的完成了调整。</p>
        </div>
        <div className="health-coach-loop-score" style={{ "--coach-loop-pct": `${progress}%` } as CSSProperties}>
          <b>{completed}/{actions.length}</b>
          <i aria-hidden />
        </div>
      </div>

      <div className="health-coach-loop-list">
        {actions.map((action) => {
          const isChecked = Boolean(checked[action.id]);
          return (
            <article className={`health-coach-loop-item ${action.tone} ${isChecked ? "checked" : ""}`} key={action.id}>
              <button
                type="button"
                aria-pressed={isChecked}
                className="health-coach-check"
                onClick={() => toggle(action.id)}
              >
                <span aria-hidden>{isChecked ? "✓" : ""}</span>
                <div>
                  <em>{isChecked ? "已完成" : action.meta}</em>
                  <strong>{action.title}</strong>
                  <p>{action.body}</p>
                </div>
              </button>
              <Link href={action.href} className="health-coach-evidence-link">
                <AppleCategoryIcon name={action.icon} />
                查看依据
              </Link>
            </article>
          );
        })}
      </div>

      <div className="health-coach-loop-foot" aria-live="polite">
        <span>
          {done
            ? "很好，今天先守住这个节奏；明天再看睡眠和活动是否有变化。"
            : `还剩 ${Math.max(0, actions.length - completed)} 项，优先完成最上面的建议。`}
        </span>
        <button type="button" onClick={reset} disabled={!completed}>
          重新勾选
        </button>
      </div>
    </section>
  );
}
