import { useState } from "react";
import { api } from "../api/client";
import { qk, useAssessment, useAssessments, useInvalidate } from "../api/hooks";
import type { AttemptResult, CourseDetail } from "../api/types";
import { Citations, Empty, ErrorBox, QualityBadge, Spinner } from "../components/ui";
import { useI18n } from "../i18n/I18n";
import type { NovaRequest } from "./Nova";

type Ask = (r: Omit<NovaRequest, "nonce">) => void;

function Runner({ id, course, ask, onClose }: { id: string; course: CourseDetail; ask: Ask; onClose: () => void }) {
  const { t } = useI18n();
  const a = useAssessment(id);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const invalidate = useInvalidate();
  if (a.isLoading) return <Spinner />;
  if (a.error || !a.data) return <ErrorBox error={a.error} />;

  async function submit() {
    try {
      const r = await api.post<AttemptResult>(`/api/assessments/${id}/attempts`, { answers });
      setResult(r);
      invalidate([...qk.assessments(course.id)], [...qk.progress(course.id)], [...qk.projects(course.id)]);
    } catch (e) {
      setErr(e);
    }
  }
  const res = (qid: string) => result?.results.find((r) => r.question_id === qid);

  return (
    <div className="card stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>{a.data.title}</h2>
        <div className="row"><QualityBadge status={a.data.quality_status} /><button className="btn btn-sm" onClick={onClose}>✕</button></div>
      </div>
      {a.data.questions.map((q, qi) => {
        const r = res(q.id);
        return (
          <fieldset key={q.id} className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: 6 }}>{qi + 1}. {q.prompt} <span className="muted small">({q.points} pt)</span></legend>
            {q.choices.map((c, ci) => {
              const cls = r ? (ci === r.correct_index ? "right" : ci === r.chosen ? "wrong" : "") : answers[q.id] === ci ? "selected" : "";
              return (
                <label key={ci} className={`choice ${cls}`}>
                  <input type="radio" name={q.id} disabled={!!result} checked={answers[q.id] === ci} onChange={() => setAnswers((s) => ({ ...s, [q.id]: ci }))} />
                  <span>{c}</span>
                </label>
              );
            })}
            {r && (
              <div className={`alert small ${r.correct ? "alert-success" : "alert-error"}`}>
                <strong>{r.correct ? t("correct") : t("incorrect")}.</strong> {r.misconception && <em>{r.misconception} </em>}{r.explanation} <Citations refs={r.citations} map={course.refs} />
                {!r.correct && r.chosen !== null && (
                  <div style={{ marginTop: 6 }}>
                    <button className="btn btn-sm" onClick={() => ask({ message: t("explainMistake"), mode: "explain_mistake", question_id: q.id, chosen_index: r.chosen! })}>
                      {t("explainMistake")}
                    </button>
                  </div>
                )}
              </div>
            )}
          </fieldset>
        );
      })}
      {err != null && <ErrorBox error={err} />}
      {!result ? (
        <button className="btn btn-primary" disabled={Object.keys(answers).length === 0} onClick={submit}>{t("submit")}</button>
      ) : (
        <div className="stack">
          <div className="alert"><strong>{t("score")}: {result.score} / {result.max}</strong></div>
          {result.gaps.length > 0 && (
            <div className="card stack" style={{ background: "var(--primary-soft)" }}>
              <strong>{t("gapTitle")}</strong>
              {result.gaps.map((g) => (
                <div key={g.concept_id} className="stack small">
                  <div><strong>{g.concept}</strong> <span className="muted">← {g.because_of.join(", ")}</span></div>
                  <div className="muted">{t("evidence")}: {g.evidence.join(" · ")}</div>
                  <div><button className="btn btn-sm btn-primary" onClick={() => ask({ message: `${t("miniLesson")}: ${g.concept}`, mode: "mini_lesson", concept_id: g.concept_id })}>{t("miniLesson")}</button></div>
                </div>
              ))}
            </div>
          )}
          <div className="row"><button className="btn" onClick={() => { setResult(null); setAnswers({}); }}>{t("retry")}</button></div>
        </div>
      )}
    </div>
  );
}

export function Practice({ course, ask }: { course: CourseDetail; ask: Ask }) {
  const { t } = useI18n();
  const list = useAssessments(course.id);
  const [open, setOpen] = useState<string | null>(null);
  if (list.isLoading) return <Spinner />;
  if (list.error) return <ErrorBox error={list.error} />;
  if (!list.data?.length) return <Empty>—</Empty>;
  if (open) return <Runner id={open} course={course} ask={ask} onClose={() => setOpen(null)} />;
  const groups: [string, string][] = [["exercise", t("exercise")], ["chapter_quiz", t("chapterQuiz")], ["mock_exam", t("mockExam")]];
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      {groups.map(([kind, label]) => {
        const items = list.data.filter((a) => a.kind === kind);
        if (!items.length) return null;
        return (
          <section key={kind} className="card stack">
            <h2>{label}</h2>
            {items.map((a) => (
              <div key={a.id} className="row" style={{ justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 8 }}>
                <div className="stack" style={{ gap: 2 }}>
                  <strong>{a.title}</strong>
                  <span className="row small muted">{a.questions} Q · <QualityBadge status={a.quality_status} />{a.best && <span className="badge badge-primary">{t("score")} {a.best.score}/{a.best.max}</span>}</span>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setOpen(a.id)}>{t("start")}</button>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
