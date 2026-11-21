import { useEffect, useState } from "react";
import { api } from "../api/client";
import { qk, useAssessment, useAssessments, useInvalidate } from "../api/hooks";
import type { AttemptResult, Community, CourseDetail } from "../api/types";
import { Icon } from "../components/Icon";
import { Rich } from "../components/Rich";
import { useToast } from "../components/Toast";
import { Citations, Empty, ErrorBox, QualityBadge, Spinner } from "../components/ui";
import { useI18n } from "../i18n/I18n";
import type { NovaRequest } from "./Nova";
import { ProblemCard } from "./Problem";
import { SpeakButton, SpeechSettings } from "../components/Speech";

type Ask = (r: Omit<NovaRequest, "nonce">) => void;

function CommunityCheck({ qid, initial }: { qid: string; initial: Community }) {
  const { t } = useI18n();
  const toast = useToast();
  const [c, setC] = useState(initial);
  const [writing, setWriting] = useState(false);
  const [body, setBody] = useState("");
  async function run(fn: () => Promise<Community>) {
    try { setC(await fn()); } catch (e) { toast((e as Error).message, "err"); }
  }
  return (
    <div className="stack small" style={{ borderTop: "1px dashed var(--line-strong)", paddingTop: 8, marginTop: 4 }}>
      <div className="row">
        <span className="eyebrow">{t("communityCheck")}</span>
        {c.verified_by_students && <span className="badge badge-success" title={c.note}><Icon name="check" size={12} /> {t("verifiedByStudents")} · {c.endorsements}</span>}
        {c.corrected_by_students && <span className="badge badge-warning" title={c.note}>{t("correctedByStudents")}</span>}
        <button className="btn btn-sm" aria-pressed={c.i_endorsed} onClick={() => run(() => api.post(`/api/questions/${qid}/endorse`))}>
          <Icon name="check" size={13} /> {t("endorse")} · {c.endorsements}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={() => setWriting((w) => !w)}>{t("proposeCorrection")}</button>
      </div>
      {c.corrections.map((x) => (
        <div key={x.id} className={`alert ${x.status === "accepted" ? "alert-warning" : ""}`} style={{ padding: "0.45rem 0.65rem" }}>
          <div className="row between" style={{ flexWrap: "nowrap" }}>
            <span><strong>{x.status === "accepted" ? t("correctedByStudents") : x.author}:</strong> <Rich text={x.body} /></span>
            <button className="btn btn-sm btn-ghost" aria-pressed={x.i_voted} onClick={() => run(() => api.post(`/api/question-corrections/${x.id}/vote`))}><Icon name="up" size={13} /> {x.votes}</button>
          </div>
        </div>
      ))}
      {writing && (
        <form className="row" style={{ flexWrap: "nowrap" }} onSubmit={(e) => { e.preventDefault(); run(() => api.post(`/api/questions/${qid}/corrections`, { body })).then(() => { setBody(""); setWriting(false); }); }}>
          <input type="text" required minLength={10} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("proposeCorrection")} aria-label={t("proposeCorrection")} />
          <button className="btn btn-sm btn-primary" type="submit">{t("send")}</button>
        </form>
      )}
      <span className="tiny muted">{c.note}</span>
    </div>
  );
}

function Runner({ id, course, ask, onClose }: { id: string; course: CourseDetail; ask: Ask; onClose: () => void }) {
  const { t } = useI18n();
  const a = useAssessment(id);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [cur, setCur] = useState(0);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const invalidate = useInvalidate();
  const qs = (a.data?.questions ?? []).filter((x) => x.qtype !== "open");
  const problems = (a.data?.questions ?? []).filter((x) => x.qtype === "open");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input[type=text], textarea") || !qs.length) return;
      const rtl = document.documentElement.dir === "rtl";
      if (e.key === (rtl ? "ArrowLeft" : "ArrowRight")) setCur((c) => Math.min(qs.length - 1, c + 1));
      if (e.key === (rtl ? "ArrowRight" : "ArrowLeft")) setCur((c) => Math.max(0, c - 1));
      const n = Number(e.key);
      if (!result && n >= 1 && n <= (qs[cur]?.choices.length ?? 0)) {
        setAnswers((s) => ({ ...s, [qs[cur].id]: n - 1 }));
        setTimeout(() => setCur((c) => Math.min(qs.length - 1, c + 1)), 220);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [qs, cur, result]);

  if (a.isLoading) return <Spinner />;
  if (a.error || !a.data) return <ErrorBox error={a.error} />;

  async function submit() {
    try {
      const r = await api.post<AttemptResult>(`/api/assessments/${id}/attempts`, { answers });
      setResult(r);
      setCur(0);
      invalidate([...qk.assessments(course.id)], [...qk.progress(course.id)], [...qk.projects(course.id)], [...qk.recs]);
    } catch (e) {
      setErr(e);
    }
  }
  const res = (qid: string) => result?.results.find((r) => r.question_id === qid);
  const q = qs[cur];
  const r = q ? res(q.id) : undefined;
  const pct = result ? Math.round((result.score / Math.max(1, result.max)) * 100) : 0;

  return (
    <div className="card stack" style={{ gap: "0.9rem" }}>
      <div className="row between">
        <div className="stack" style={{ gap: 2 }}>
          <span className="eyebrow">{{ exercise: t("exercise"), chapter_quiz: t("chapterQuiz"), mock_exam: t("mockExam") }[a.data.kind] ?? a.data.kind}</span>
          <h2 style={{ margin: 0 }}><Rich text={a.data.title} /></h2>
        </div>
        <div className="row"><SpeechSettings /><QualityBadge status={a.data.quality_status} /><button className="btn btn-sm btn-ghost btn-icon" onClick={onClose} aria-label="close"><Icon name="x" /></button></div>
      </div>
      {qs.length > 0 && problems.length > 0 && <h3 className="row" style={{ margin: 0 }}><Icon name="question" size={16} /> {t("quickQuestions")}</h3>}
      {result && (
        <div className="row" style={{ background: "var(--paper)", padding: "0.8rem", borderRadius: 12 }}>
          <div className="ring" style={{ ["--p" as string]: pct }}><span>{pct}%</span></div>
          <div><strong>{t("score")}: {result.score} / {result.max}</strong><div className="small muted">{result.results.filter((x) => !x.correct).length} {t("incorrect").toLowerCase()}</div></div>
          <span style={{ flex: 1 }} />
          <button className="btn btn-sm" onClick={() => { setResult(null); setAnswers({}); setCur(0); }}>{t("retry")}</button>
        </div>
      )}
      {qs.length > 0 && <div className="qnav" role="tablist" aria-label="questions">
        {qs.map((qq, i) => {
          const rr = res(qq.id);
          const cls = rr ? (rr.correct ? "right" : "wrong") : answers[qq.id] !== undefined ? "answered" : "";
          return <button key={qq.id} role="tab" aria-selected={i === cur} className={`qdot ${cls}${i === cur ? " current" : ""}`} onClick={() => setCur(i)}>{i + 1}</button>;
        })}
      </div>}
      {q && (
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0 }} key={q.id}>
          <legend style={{ fontWeight: 600, marginBottom: 8, fontSize: "1.05rem", width: "100%" }}>
            <span className="row between" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
              <span><span className="muted">{cur + 1}.</span> <Rich text={q.prompt} /> <span className="muted small">({q.points} pt)</span></span>
              <SpeakButton id={`q-${q.id}`} label="" text={`${q.prompt}. ${q.choices.map((c, i) => `${i + 1}: ${c}`).join(". ")}`} />
            </span>
          </legend>
          {q.choices.map((c, ci) => {
            const cls = r ? (ci === r.correct_index ? "right" : ci === r.chosen ? "wrong" : "") : answers[q.id] === ci ? "selected" : "";
            return (
              <label key={ci} className={`choice ${cls}`}>
                <input type="radio" name={q.id} disabled={!!result} checked={answers[q.id] === ci} onChange={() => setAnswers((s) => ({ ...s, [q.id]: ci }))} />
                <span className="choice-key">{ci + 1}</span>
                <Rich text={c} />
              </label>
            );
          })}
          {r && (
            <div className={`alert small ${r.correct ? "alert-success" : "alert-error"}`} style={{ color: "var(--ink)" }}>
              <strong style={{ color: r.correct ? "var(--success)" : "var(--error)" }}>{r.correct ? t("correct") : t("incorrect")}.</strong>{" "}
              {r.misconception && <em><Rich text={r.misconception} /> </em>}<Rich text={r.explanation} /> <Citations refs={r.citations} map={course.refs} />
              {!r.correct && r.chosen !== null && (
                <div style={{ marginTop: 6 }}>
                  <button className="btn btn-sm btn-primary" onClick={() => ask({ message: t("explainMistake"), mode: "explain_mistake", question_id: q.id, chosen_index: r.chosen! })}>
                    <Icon name="chat" size={14} /> {t("explainMistake")}
                  </button>
                </div>
              )}
              <CommunityCheck qid={q.id} initial={r.community} />
            </div>
          )}
        </fieldset>
      )}
      {qs.length > 0 && <div className="row between">
        <div className="row">
          <button className="btn btn-sm" disabled={cur === 0} onClick={() => setCur((c) => c - 1)}><Icon name="back" size={14} /></button>
          <button className="btn btn-sm" disabled={cur >= qs.length - 1} onClick={() => setCur((c) => c + 1)}><Icon name="arrow" size={14} /></button>
          <span className="tiny muted">{t("questionShortcuts")}</span>
        </div>
        {!result && <button className="btn btn-primary" disabled={Object.keys(answers).length === 0} onClick={submit}>{t("submit")} · {Object.keys(answers).length}/{qs.length}</button>}
      </div>}
      {err != null && <ErrorBox error={err} />}
      {problems.length > 0 && (
        <section className="stack" style={{ marginTop: qs.length ? "0.6rem" : 0 }}>
          <h3 className="row" style={{ margin: 0 }}><Icon name="wand" size={16} /> {t("problems")}</h3>
          {problems.map((pb, i) => <ProblemCard key={pb.id} q={pb} index={i + 1} course={course} onGraded={() => invalidate([...qk.progress(course.id)], [...qk.recs])} />)}
        </section>
      )}
      {result && result.gaps.length > 0 && (
        <div className="card stack" style={{ background: "var(--primary-soft)", borderColor: "var(--primary-line)" }}>
          <strong><Icon name="target" size={16} /> {t("gapTitle")}</strong>
          {result.gaps.map((g) => (
            <div key={g.concept_id} className="stack small" style={{ gap: 4 }}>
              <div><strong>{g.concept}</strong> <span className="muted">← {g.because_of.join(", ")}</span></div>
              <div className="muted">{t("evidence")}: {g.evidence.join(" · ")}</div>
              <div><button className="btn btn-sm btn-accent" onClick={() => ask({ message: `${t("miniLesson")}: ${g.concept}`, mode: "mini_lesson", concept_id: g.concept_id })}>{t("miniLesson")}</button></div>
            </div>
          ))}
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
  const groups: [string, string, string][] = [["exercise", t("exercise"), "wand"], ["chapter_quiz", t("chapterQuiz"), "question"], ["mock_exam", t("mockExam"), "file"]];
  return (
    <div className="stack" style={{ gap: "1.2rem" }}>
      {groups.map(([kind, label, icon]) => {
        const items = list.data.filter((a) => a.kind === kind);
        if (!items.length) return null;
        return (
          <section key={kind} className="stack">
            <h2 className="row" style={{ margin: 0 }}><Icon name={icon} /> {label}</h2>
            <div className="grid grid-2">
              {items.map((a) => {
                const pct = a.best ? Math.round((a.best.score / Math.max(1, a.best.max)) * 100) : null;
                return (
                  <button key={a.id} className="card card-hover row" style={{ textAlign: "start", font: "inherit", cursor: "pointer", color: "inherit", flexWrap: "nowrap" }} onClick={() => setOpen(a.id)}>
                    <div className="ring" style={{ ["--p" as string]: pct ?? 0, width: 52, height: 52, fontSize: "0.78rem" }}><span>{pct === null ? "—" : `${pct}%`}</span></div>
                    <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                      <strong className="assess-title"><Rich text={a.title.replace(/^(Quiz|Exercices) — /, "")} /></strong>
                      <span className="row tiny muted" style={{ gap: "0.45rem" }}>
                        <span>{a.questions} Q{a.problems ? ` · ${a.problems} ${t("problems").toLowerCase()}` : ""}</span>
                        <QualityBadge status={a.quality_status} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
