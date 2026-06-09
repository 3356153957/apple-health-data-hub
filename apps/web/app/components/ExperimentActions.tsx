"use client";

import { useState, useTransition } from "react";

import type { ActionResult } from "../lib/actions";
import { abandonExperimentAction, analyzeExperimentAction } from "../lib/actions";

// 正在观察的个人实验操作。分析会重新计算当前结果，停止会结束继续观察。
export function ExperimentActions({ id, status }: { id: string; status: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await action();
      setError(result.ok ? null : (result.error ?? "操作失败，请稍后再试。"));
    });

  if (status === "abandoned") return null;

  return (
    <div className="exp-action">
      <button
        type="button"
        className="btn"
        disabled={pending}
        onClick={() => run(() => analyzeExperimentAction(id))}
      >
        {pending ? "正在分析..." : "立即分析"}
      </button>
      {status === "collecting" && (
        <button
          type="button"
          className="btn btn-ghost"
          disabled={pending}
          onClick={() => run(() => abandonExperimentAction(id))}
        >
          停止
        </button>
      )}
      {error && <span className="exp-error">{error}</span>}
    </div>
  );
}
