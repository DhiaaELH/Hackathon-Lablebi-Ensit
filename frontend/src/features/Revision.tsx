import { useState } from "react";
import { useRevision } from "../api/hooks";
import type { CourseDetail, Revision as RevisionT } from "../api/types";
import { Citations, Empty, ErrorBox, QualityBadge, Spinner } from "../components/ui";
import { useI18n } from "../i18n/I18n";

function Flashcard({ c, course }: { c: NonNullable<RevisionT["revision"]>["flashcards"][number]; course: CourseDetail }) {
  const [flipped, setFlipped] = useState(false);
  const { t } = useI18n();
  return (
    <button type="button" className="card flashcard" onClick={() => setFlipped((f) => !f)} aria-label={`${t("flip")}: ${c.front}`} aria-pressed={flipped}
      style={{ font: "inherit", width: "100%" }}>
      <span className="badge" style={{ alignSelf: "center", marginBottom: 6 }}>{c.kind}</span>
      {flipped ? <span>{c.back}</span> : <span className="front">{c.front}</span>}
      {flipped && <span style={{ marginTop: 6 }} onClick={(e) => e.stopPropagation()}><Citations refs={c.citations} map={course.refs} /></span>}
    </button>
  );
}

export function RevisionTab({ course }: { course: CourseDetail }) {
  const { t } = useI18n();
  const r = useRevision(course.id);
  if (r.isLoading) return <Spinner />;
  if (r.error) return <ErrorBox error={r.error} />;
  const rev = r.data?.revision;
  if (!rev) return <Empty>—</Empty>;
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <QualityBadge status={r.data?.quality_status} />
        <a className="btn btn-primary" href={`/api/courses/${course.id}/revision.pdf`} download>⤓ {t("downloadPdf")}</a>
      </div>
      <section className="card stack">
        <h2>{t("summary")}</h2>
        {rev.summaries.map((s) => (
          <div key={s.chapter_title} className="section-block">
            <h3>{s.chapter_title} <Citations refs={s.citations} map={course.refs} /></h3>
            <ul className="term-list">{s.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
          </div>
        ))}
      </section>
      <section className="stack">
        <h2>{t("flashcards")}</h2>
        <div className="grid grid-2">{rev.flashcards.map((c, i) => <Flashcard key={i} c={c} course={course} />)}</div>
      </section>
    </div>
  );
}
