import { useState, type FormEvent } from "react";
import { api } from "../api/client";
import { qk, useCourses, useInsights, useInvalidate } from "../api/hooks";
import { Empty, ErrorBox, Spinner } from "../components/ui";
import { useI18n } from "../i18n/I18n";
import type { MessageKey } from "../i18n/messages";
import { Icon } from "../components/Icon";

const REASONS = ["vocabulary", "missing_prerequisite", "too_fast", "need_example", "exercise_too_hard"];

function heatColor(n: number | null, max: number) {
  if (n === null) return { background: "var(--surface-2)", color: "var(--muted)" };
  const a = 0.15 + 0.75 * (n / Math.max(max, 1));
  return { background: `rgba(15, 118, 110, ${a.toFixed(2)})`, color: a > 0.55 ? "#fff" : "var(--text)" };
}

export function TeacherInsights() {
  const { t } = useI18n();
  const courses = useCourses();
  const teachable = courses.data?.filter((c) => c.access === "owner" || c.access === "teacher") ?? [];
  const [courseId, setCourseId] = useState<string | null>(null);
  const cid = courseId ?? teachable[0]?.id ?? null;
  const ins = useInsights(cid);
  const invalidate = useInvalidate();
  const [section, setSection] = useState("");
  const [kind, setKind] = useState("clarification");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  if (courses.isLoading) return <Spinner />;
  if (!teachable.length) return <Empty>{t("noTeacherCourses")}</Empty>;

  async function post(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post(`/api/courses/${cid}/teacher-responses`, { section_id: section || null, kind, body });
      setBody(""); setSent(true);
      invalidate([...qk.insights(cid!)]);
    } catch (e2) {
      setErr(e2);
    }
  }
  const d = ins.data;
  const max = Math.max(0, ...(d?.heatmap.map((h) => h.students ?? 0) ?? [0]));
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>{t("insights")}</h1>
        <select value={cid ?? ""} onChange={(e) => setCourseId(e.target.value)} style={{ maxWidth: 420 }} aria-label="Course">
          {teachable.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>
      {ins.isLoading && <Spinner />}
      {ins.error && <ErrorBox error={ins.error} />}
      {d && (
        <>
          <div className="alert small"><Icon name="lock" size={14} /> {d.privacy_note}</div>
          <section className="card stack">
            <h2>{t("heatmap")}</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>{t("section")}</th><th>{t("students")}</th>{REASONS.map((r) => <th key={r}>{t(`reason_${r}` as MessageKey)}</th>)}<th>{t("topReason")}</th></tr></thead>
                <tbody>
                  {d.heatmap.map((h) => (
                    <tr key={h.section_id}>
                      <td><span className="small muted">{h.chapter}</span><br />{h.section}</td>
                      <td><span className="heat" style={heatColor(h.students, max)}>{h.students ?? "—"}</span>{h.suppressed && <div className="small muted">{t("hidden")}</div>}</td>
                      {REASONS.map((r) => <td key={r}>{h.reasons[r] ?? <span className="muted">—</span>}</td>)}
                      <td>{h.top_reason ? t(`reason_${h.top_reason}` as MessageKey) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="grid grid-2">
            <section className="card stack">
              <h2>{t("mostFailed")}</h2>
              {d.most_failed_questions.length === 0 && <p className="muted small">{t("hidden")}</p>}
              {d.most_failed_questions.map((q) => (
                <div key={q.question_id} className="small"><strong>{Math.round(q.failure_rate * 100)}%</strong> · {q.prompt} <span className="muted">({q.students} {t("students")})</span></div>
              ))}
            </section>
            <section className="card stack">
              <h2>{t("trend")}</h2>
              {d.trend.length === 0 && <p className="muted small">{t("hidden")}</p>}
              {d.trend.map((w) => (
                <div key={w.week} className="row small"><span style={{ width: 90 }}>{w.week}</span>
                  <span className="progress-bar" style={{ flex: 1 }}><span style={{ width: `${Math.min(100, w.students * 12)}%` }} /></span><span>{w.students}</span></div>
              ))}
              <h3>{t("thisChapterIsHard")}</h3>
              {d.hard_chapters.map((h) => <div key={h.chapter_id} className="small">{h.chapter}: <strong>{h.votes ?? t("hidden")}</strong></div>)}
            </section>
          </div>
          <form className="card stack" onSubmit={post}>
            <h2>{t("postResponse")}</h2>
            <div className="row">
              <select value={section} onChange={(e) => setSection(e.target.value)} aria-label={t("section")} style={{ maxWidth: 360 }}>
                <option value="">—</option>
                {d.heatmap.map((h) => <option key={h.section_id} value={h.section_id}>{h.section}</option>)}
              </select>
              <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Type" style={{ maxWidth: 260 }}>
                {["clarification", "extra_exercise", "next_session", "pinned_answer"].map((k) => <option key={k} value={k}>{t(`kind_${k}` as MessageKey)}</option>)}
              </select>
            </div>
            <textarea required minLength={3} value={body} onChange={(e) => { setBody(e.target.value); setSent(false); }} aria-label={t("body")} />
            {sent && <div className="alert alert-success small">✓ {t("saved")}</div>}
            {err != null && <ErrorBox error={err} />}
            <div><button className="btn btn-primary" type="submit">{t("postResponse")}</button></div>
          </form>
          <section className="card stack">
            <h2>{t("teacherResponses")}</h2>
            {d.responses.map((r) => <div key={r.id} className="small"><span className="badge">{t(`kind_${r.kind}` as MessageKey)}</span> {r.body}</div>)}
          </section>
        </>
      )}
    </div>
  );
}
