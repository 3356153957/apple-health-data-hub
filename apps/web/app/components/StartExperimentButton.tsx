"use client";

import { useState, useTransition } from "react";

import { startExperimentAction } from "../lib/actions";

// 把可验证的想法转成一次正式观察，并在按钮旁显示执行反馈。
export function StartExperimentButton({ lever, outcome }: { lever: string; outcome: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="exp-action">
      <button
        type="button"
        className="btn"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMessage(null);
            const result = await startExperimentAction(lever, outcome);
            setError(result.ok ? null : (result.error ?? "暂时无法开始，请稍后再试。"));
            if (result.ok) setMessage("已开始观察，稍后会出现在个人实验列表。");
          })
        }
      >
        {pending ? "正在开始..." : "开始尝试"}
      </button>
      {message && <span className="exp-success" aria-live="polite">{message}</span>}
      {error && <span className="exp-error">{error}</span>}
    </div>
  );
}
