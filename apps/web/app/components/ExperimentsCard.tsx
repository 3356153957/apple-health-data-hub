import type {
  Candidate,
  Candidates,
  Experiment,
  ExperimentList,
  ExperimentResult,
} from "../lib/api";
import { ExperimentActions } from "./ExperimentActions";
import { StartExperimentButton } from "./StartExperimentButton";

function short(metricId: string | null): string {
  if (!metricId) return "—";
  return (metricId.split(".").pop() ?? metricId).replace(/_/g, " ");
}

function coeffLabel(candidate: Candidate): string | null {
  return typeof candidate.coefficient === "number" ? candidate.coefficient.toFixed(2) : null;
}

function num(value: number | null, digits = 2): string {
  return typeof value === "number" ? value.toFixed(digits) : "—";
}

function pairKey(lever: string | null, outcome: string | null): string {
  return [lever ?? "", outcome ?? ""].sort().join("~");
}

// How much weight the inference carries — kept honest (descriptive vs tested).
function inferenceLabel(inference: string | null): string {
  switch (inference) {
    case "randomization_test":
      return "随机对照检验";
    case "descriptive_only":
      return "记录较少，先作为描述参考";
    case "observational":
      return "观察性关联，不代表因果";
    case "insufficient":
      return "数据还不够";
    default:
      return inference ?? "—";
  }
}

function adherenceStatus(result: ExperimentResult): string | null {
  const adherence = result.adherence;
  if (!adherence || typeof adherence !== "object") return null;
  const status = (adherence as { status?: unknown }).status;
  return typeof status === "string" ? status : null;
}

function adherenceNote(result: ExperimentResult): string | null {
  const adherence = result.adherence;
  if (!adherence || typeof adherence !== "object") return null;
  const note = (adherence as { note?: unknown }).note;
  return typeof note === "string" ? note : null;
}

function ResultBlock({ result }: { result: ExperimentResult }) {
  const observational = result.inference === "observational";
  const insufficient = result.inference === "insufficient";
  const adherence = adherenceStatus(result);
  return (
    <div className="exp-result">
      <div className="exp-result-head">
        <span className="type-badge">{observational ? "早期观察" : "结果"}</span>
        {result.summary && <span className="evidence-sum">{result.summary}</span>}
      </div>
      {!insufficient && (
        <div className="exp-stats">
          {result.p_value != null ? (
            <span>p={num(result.p_value, 3)}</span>
          ) : (
            <span>{inferenceLabel(result.inference)}</span>
          )}
          {result.effect_size != null && <span>d={num(result.effect_size)}</span>}
          {result.n_a != null && result.n_b != null && (
            <span>
              {result.n_a} 天 vs {result.n_b} 天
            </span>
          )}
          {adherence && <span className={`adherence ${adherence}`}>执行情况：{adherence}</span>}
        </div>
      )}
      {(result.caveat || adherenceNote(result)) && (
        <details className="calc">
          <summary>说明与计算</summary>
          <div className="exp-caveat">
            {adherenceNote(result) && <p>{adherenceNote(result)}</p>}
            {result.caveat && <p>{result.caveat}</p>}
            <dl className="calc-grid">
              <div className="calc-row">
                <dt>基线平均</dt>
                <dd>{num(result.mean_a)}</dd>
              </div>
              <div className="calc-row">
                <dt>尝试后平均</dt>
                <dd>{num(result.mean_b)}</dd>
              </div>
              <div className="calc-row">
                <dt>差异</dt>
                <dd>{num(result.diff)}</dd>
              </div>
              <div className="calc-row">
                <dt>判断方式</dt>
                <dd>{inferenceLabel(result.inference)}</dd>
              </div>
            </dl>
          </div>
        </details>
      )}
    </div>
  );
}

function ExperimentRow({ experiment }: { experiment: Experiment }) {
  const prog = experiment.progress;
  const retro = experiment.results.retrospective;
  const controlled = experiment.results.controlled;
  const collecting = experiment.status === "collecting";
  return (
    <li className={`exp-item ${experiment.status === "abandoned" ? "muted-item" : ""}`}>
      <div className="cand-head">
        <span className="cand-hyp">
          {experiment.lever} → {experiment.outcome}
        </span>
        <span className={`badge ${experiment.status === "completed" ? "ready" : "waiting"}`}>
          {experiment.status}
        </span>
      </div>
      {experiment.hypothesis && <p className="cand-rationale">&ldquo;{experiment.hypothesis}&rdquo;</p>}

      {collecting && (
        <div className="exp-progress">
          <div className="exp-bar">
            <div className="exp-bar-fill" style={{ width: `${Math.round(prog.pct * 100)}%` }} />
          </div>
          <div className="meta">
            {prog.is_complete
              ? "周期已完成，可以分析"
              : `第 ${prog.day_index}/${prog.total_days} 天${
                  prog.current_phase ? ` · 阶段 ${prog.current_phase}` : ""
                } · 还剩 ${prog.days_remaining} 天`}
          </div>
        </div>
      )}

      {retro && <ResultBlock result={retro} />}
      {controlled && <ResultBlock result={controlled} />}

      <ExperimentActions id={experiment.id} status={experiment.status} />
    </li>
  );
}

function TestableRow({ candidate }: { candidate: Candidate }) {
  const r = coeffLabel(candidate);
  const lever = candidate.readiness.lever;
  const outcome = candidate.readiness.outcome;
  return (
    <li className="cand-item">
      <div className="cand-head">
        <span className="cand-hyp">
          {short(lever)} → {short(outcome)}
        </span>
        <span className="badge ready">可尝试</span>
        {r && <span className="cand-strength">r={r}</span>}
      </div>
      {candidate.readiness.suggested_protocol && (
        <p className="cand-protocol">{candidate.readiness.suggested_protocol}</p>
      )}
      {lever && outcome && <StartExperimentButton lever={lever} outcome={outcome} />}
    </li>
  );
}

function NotTestableRow({ candidate }: { candidate: Candidate }) {
  const r = coeffLabel(candidate);
  return (
    <li className="cand-item muted-item">
      <div className="cand-head">
        <span className="cand-hyp">
          {short(candidate.metric_a)} ~ {short(candidate.metric_b)}
        </span>
        <span className="badge waiting">暂不适合直接尝试</span>
        {r && <span className="cand-strength">r={r}</span>}
      </div>
      <p className="cand-rationale">{candidate.readiness.rationale}</p>
    </li>
  );
}

export function ExperimentsCard({
  experiments,
  candidates,
}: {
  experiments: ExperimentList | null;
  candidates: Candidates | null;
}) {
  if (experiments === null && candidates === null) {
    return (
      <article className="card experiments">
        <h2>接下来可以尝试</h2>
        <p className="empty">暂时无法连接健康服务，恢复后会显示建议。</p>
      </article>
    );
  }

  const exps = experiments?.experiments ?? [];
  const allCandidates = candidates?.candidates ?? [];
  const testable = allCandidates.filter((c) => c.readiness.verdict === "testable");
  const notTestable = allCandidates.filter((c) => c.readiness.verdict !== "testable");

  // Don't offer to start a pair that's already running.
  const runningPairs = new Set(
    exps
      .filter((e) => e.status !== "abandoned")
      .map((e) => pairKey(e.lever_metric_id, e.outcome_metric_id)),
  );
  const startable = testable.filter(
    (c) => !runningPairs.has(pairKey(c.readiness.lever, c.readiness.outcome)),
  );

  return (
    <article className="card experiments">
      <h2>接下来可以尝试</h2>

      {exps.length > 0 && (
        <>
          <div className="brief-meta">正在进行</div>
          <ul className="cand-list">
            {exps.map((experiment) => (
              <ExperimentRow key={experiment.id} experiment={experiment} />
            ))}
          </ul>
        </>
      )}

      <div className="brief-meta">
        {startable.length > 0
          ? `${startable.length} 个可开始的想法`
          : "开始新的尝试"}
      </div>
      {startable.length > 0 ? (
        <ul className="cand-list">
          {startable.map((candidate) => (
            <TestableRow key={pairKey(candidate.metric_a, candidate.metric_b)} candidate={candidate} />
          ))}
        </ul>
      ) : (
        <p className="empty">
          {exps.length > 0
            ? "现在暂时没有新的尝试建议。"
            : "还没有形成建议，同步更多记录后会自动整理。"}
        </p>
      )}

      {notTestable.length > 0 && (
        <details className="calc">
          <summary>{notTestable.length} 项暂不适合直接尝试</summary>
          <ul className="cand-list">
            {notTestable.map((candidate) => (
              <NotTestableRow
                key={pairKey(candidate.metric_a, candidate.metric_b)}
                candidate={candidate}
              />
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
