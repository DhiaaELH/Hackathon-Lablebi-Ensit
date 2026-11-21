import { useProgress } from "../api/hooks";
import type { CourseDetail } from "../api/types";
import { ErrorBox, ProgressBar, Spinner } from "../components/ui";
import { useI18n } from "../i18n/I18n";
import { Icon } from "../components/Icon";
import { Rich, texToPlain } from "../components/Rich";

export function ProgressTab({ course }: { course: CourseDetail }) {
  const { t } = useI18n();
  const p = useProgress(course.id);
  if (p.isLoading) return <Spinner />;
  if (p.error || !p.data) return <ErrorBox error={p.error} />;
  const d = p.data;
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="alert small"><Icon name="lock" size={14} /> {t("privateProgress")}</div>
      <section className="card stack">
        <h2>{t("completionCriteria")}</h2>
        <p className="small muted">{t("criteriaText")}</p>
        {d.chapters.map((c) => (
          <div key={c.chapter_id} className="stack" style={{ gap: 4 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span><Rich text={c.title} /></span>
              <span className="small muted">{c.sections_done}/{c.sections_total} · quiz {c.best_quiz_ratio === null ? "—" : `${Math.round(c.best_quiz_ratio * 100)}%`} {c.complete ? "✓" : ""}</span>
            </div>
            <ProgressBar value={c.sections_total ? c.sections_done / c.sections_total : 0} label={texToPlain(c.title)} />
          </div>
        ))}
      </section>
      <section className="card stack">
        <h2>{t("conceptTrends")}</h2>
        {d.concepts.length === 0 && <p className="muted small">—</p>}
        <div className="table-wrap">
          <table>
            <thead><tr><th>Concept</th><th>{t("evidence")}</th><th>Trend</th></tr></thead>
            <tbody>{d.concepts.map((c) => (
              <tr key={c.concept_id}><td><Rich text={c.name} /></td><td>{c.evidence}</td>
                <td><span className={`badge ${c.trend === "solid" ? "badge-success" : c.trend === "building" ? "badge-primary" : "badge-warning"}`}>{c.trend}</span></td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>
      <section className="card stack">
        <h2>{t("history")}</h2>
        <div className="table-wrap">
          <table>
            <tbody>{[...d.history].reverse().map((h, i) => (
              <tr key={i}><td>{new Date(h.at).toLocaleString()}</td><td><Rich text={h.title} /></td><td>{h.score}/{h.max}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
