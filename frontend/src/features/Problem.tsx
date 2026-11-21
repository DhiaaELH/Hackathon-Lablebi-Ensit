import { useState } from "react";
import { api } from "../api/client";
import type { AssessmentDetail, CourseDetail, OpenGradeT, SolutionT } from "../api/types";
import { Icon } from "../components/Icon";
import { Rich } from "../components/Rich";
import { SpeakButton } from "../components/Speech";
import { useToast } from "../components/Toast";
import { Citations } from "../components/ui";
import { useI18n } from "../i18n/I18n";
import type { MessageKey } from "../i18n/messages";

type Q = AssessmentDetail["questions"][number];

/** A full TD-style exercise: statement → progressive hints → written answer → AI grading → worked solution. */
export function ProblemCard({ q, index, course, onGraded }: { q: Q; index: number; course: CourseDetail; onGraded?: () => void }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const last = q.my_last && q.my_last.score !== null ? q.my_last : null;
  const [answer, setAnswer] = useState(last?.answer ?? "");
  const [hints, setHints] = useState(0);
  const [busy, setBusy] = useState(false);
  const [grade, setGrade] = useState<OpenGradeT | null>(last?.grading ?? null);
  const [solution, setSolution] = useState<SolutionT | null>(null);

  async function submit() {
    setBusy(true);
    try {
      const g = await api.post<OpenGradeT>(`/api/questions/${q.id}/open-answer`, { answer, hints_used: hints, language: lang }, 90_000);
      setGrade(g);
      onGraded?.();
    } catch (e) {
      toast((e as Error).message === "timeout" ? t("novaTimeout") : (e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  }
  async function showSolution(giveUp: boolean) {
    try {
      setSolution(await api.get<SolutionT>(`/api/questions/${q.id}/solution${giveUp ? "?give_up=true" : ""}`));
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }
  const pct = grade?.score ?? 0;
  const diff = q.difficulty ? t(`${q.difficulty}D` as MessageKey) : null;

  return (
    <article className="problem stack" aria-labelledby={`pb-${q.id}`}>
      <div className="row between">
        <div className="row">
          <span className="eyebrow" id={`pb-${q.id}`}>{t("problems")} {index}</span>
          {diff && <span className={`badge ${q.difficulty === "hard" ? "badge-error" : q.difficulty === "medium" ? "badge-warning" : "badge-success"}`}>{diff}</span>}
          <span className="badge">{q.points} pts</span>
        </div>
        <SpeakButton id={`pb-${q.id}`} text={q.prompt} />
      </div>
      <Rich as="div" text={q.prompt} />
      <div><Citations refs={q.citations} map={course.refs} /></div>

      {q.hints.slice(0, hints).map((h, i) => (
        <div key={i} className="hint small"><strong>{t("showHint")} {i + 1}.</strong> <Rich text={h} /></div>
      ))}

      {!solution && (
        <>
          <label className="field">
            <span>{t("yourAnswer")}</span>
            <textarea className="answer-box" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder={t("answerPlaceholder")} />
          </label>
          {answer.includes("$") && (
            <div className="math-preview small"><span className="tiny muted">{t("preview")} · </span><Rich as="div" text={answer} /></div>
          )}
          <div className="row">
            <button className="btn btn-primary" disabled={busy || !answer.trim()} onClick={submit}>
              {busy ? <><span className="spinner" /> {t("grading")}</> : <><Icon name="check" size={15} /> {t("submitAnswer")}</>}
            </button>
            {hints < q.hints.length && (
              <button className="btn" onClick={() => setHints((h) => h + 1)}><Icon name="question" size={15} /> {t("showHint")} ({hints + 1}/{q.hints.length})</button>
            )}
            <span style={{ flex: 1 }} />
            {grade ? (
              <button className="btn btn-ghost" onClick={() => showSolution(false)}><Icon name="book" size={15} /> {t("seeSolution")}</button>
            ) : (
              <button className="btn btn-ghost" onClick={() => { if (confirm(t("giveUp") + " ?")) showSolution(true); }}>{t("giveUp")}</button>
            )}
          </div>
        </>
      )}

      {grade && (
        <div className="stack" style={{ background: "var(--paper)", borderRadius: 12, padding: "0.8rem" }} aria-live="polite">
          <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
            <div className="ring" style={{ ["--p" as string]: pct, background: `conic-gradient(${pct >= 60 ? "var(--success)" : pct >= 35 ? "var(--warning)" : "var(--error)"} calc(var(--p) * 1%), var(--paper-2) 0)` }}>
              <span>{pct}</span>
            </div>
            <div className="stack" style={{ gap: 6, flex: 1 }}>
              <Rich as="div" text={grade.feedback} />
              {grade.misconception && <em className="small muted"><Rich text={grade.misconception} /></em>}
              {grade.demo && <span className="badge badge-warning" style={{ alignSelf: "flex-start" }}>{t("demo")}</span>}
            </div>
          </div>
          <ul className="rubric small">
            {grade.met.map((m) => <li key={`m${m}`}><Icon name="check" size={15} className="ok-ic" /> <span><Rich text={m} /></span></li>)}
            {grade.missing.map((m) => <li key={`x${m}`}><Icon name="x" size={15} className="no-ic" /> <span><Rich text={m} /></span></li>)}
          </ul>
        </div>
      )}

      {solution && (
        <div className="stack" style={{ borderTop: "1px dashed var(--line-strong)", paddingTop: 10 }}>
          <div className="row between">
            <strong><Icon name="book" size={15} /> {t("solution")}</strong>
            <SpeakButton id={`sol-${q.id}`} text={solution.solution} />
          </div>
          <Rich as="div" text={solution.solution} />
          <ul className="rubric small">{solution.rubric.map((r) => <li key={r}><Icon name="target" size={14} /> <Rich text={r} /></li>)}</ul>
          {!grade && <button className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setSolution(null)}>{t("retry")}</button>}
        </div>
      )}
    </article>
  );
}
