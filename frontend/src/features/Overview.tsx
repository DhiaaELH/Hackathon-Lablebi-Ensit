import { useEffect, useState } from "react";
import { api } from "../api/client";
import { qk, useInvalidate, useProgress, useTeacherResponses } from "../api/hooks";
import type { CourseDetail, SectionT } from "../api/types";
import { Citations, ProgressBar } from "../components/ui";
import { useI18n } from "../i18n/I18n";
import type { MessageKey } from "../i18n/messages";
import { Icon } from "../components/Icon";
import { Rich } from "../components/Rich";

const REASONS = ["vocabulary", "missing_prerequisite", "too_fast", "need_example", "exercise_too_hard"] as const;

function ConfusionSignal({ section }: { section: SectionT }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [notify, setNotify] = useState(true);
  const [result, setResult] = useState<{ recorded: boolean; anonymity: string } | null>(null);
  async function send() {
    const r = await api.post<{ recorded: boolean; anonymity: string }>(`/api/sections/${section.id}/confusion`, { reasons, notify });
    setResult(r);
  }
  if (result)
    return (
      <div className={`alert ${result.recorded ? "alert-success" : ""} small`} role="status">
        {result.recorded ? t("signalSent") : t("alreadySignalled")} <span className="muted">{result.anonymity}</span>
      </div>
    );
  return (
    <div>
      <button className="btn btn-sm btn-ghost" aria-expanded={open} onClick={() => setOpen((o) => !o)}><Icon name="question" size={15} /> {t("notUnderstood")}</button>
      {open && (
        <div className="card stack" style={{ marginTop: 8 }}>
          <span className="small">{t("signalReasons")}</span>
          <div className="chips">
            {REASONS.map((r) => (
              <button key={r} type="button" className="chip" aria-pressed={reasons.includes(r)}
                onClick={() => setReasons((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]))}>
                {t(`reason_${r}` as MessageKey)}
              </button>
            ))}
          </div>
          <label className="check small"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> {t("notifyMe")}</label>
          <div className="row"><button className="btn btn-primary btn-sm" onClick={send}>{t("send")}</button></div>
        </div>
      )}
    </div>
  );
}

export function Overview({ course, focusSection }: { course: CourseDetail; focusSection?: string | null }) {
  const { t } = useI18n();
  const progress = useProgress(course.id);
  const responses = useTeacherResponses(course.id);
  const invalidate = useInvalidate();
  const [justDone, setJustDone] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!focusSection) return;
    const el = document.getElementById(`section-${focusSection}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.remove("flash");
      void el.offsetWidth;
      el.classList.add("flash");
    }
  }, [focusSection]);
  const isDone = (id: string) => justDone.has(id) || !!progress.data?.done_section_ids.includes(id);

  async function complete(id: string) {
    await api.post(`/api/sections/${id}/complete`);
    setJustDone((s) => new Set(s).add(id));
    invalidate([...qk.progress(course.id)], [...qk.projects(course.id)]);
  }
  async function hard(chapterId: string) {
    await api.post(`/api/chapters/${chapterId}/hard`);
    invalidate([...qk.course(course.id)]);
  }

  const p = progress.data;
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      {p && (
        <div className="card stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{t("progress")}</strong>
            <span className="small muted">{p.sections_done}/{p.sections_total} {t("sectionsDone")}</span>
          </div>
          <ProgressBar value={p.sections_total ? p.sections_done / p.sections_total : 0} label={t("progress")} />
          <span className="small muted">{t("criteriaText")}</span>
        </div>
      )}
      {course.analysis_notes && course.analysis_notes.missing_or_ambiguous.length > 0 && (
        <div className="alert small"><strong>{t("missing")} (Clara):</strong> {course.analysis_notes.missing_or_ambiguous.join(" · ")}</div>
      )}
      <nav className="toc" aria-label="sections">
        {course.chapters.flatMap((ch) => ch.sections).map((s) => (
          <a key={s.id} href={`#section-${s.id}`} className={`chip${isDone(s.id) ? " done" : ""}`} aria-pressed={isDone(s.id)} style={{ textDecoration: "none" }}
            onClick={(e) => { e.preventDefault(); document.getElementById(`section-${s.id}`)?.scrollIntoView({ behavior: "smooth" }); }}>
            {isDone(s.id) && <Icon name="check" size={12} />} {s.title.length > 28 ? s.title.slice(0, 27) + "…" : s.title}
          </a>
        ))}
      </nav>
      {course.chapters.map((ch) => {
        const chProg = p?.chapters.find((c) => c.chapter_id === ch.id);
        return (
          <section key={ch.id} className="card" aria-labelledby={`ch-${ch.id}`}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h2 id={`ch-${ch.id}`} style={{ margin: 0 }}>{ch.title}</h2>
              <div className="row">
                {chProg?.complete && <span className="badge badge-success"><Icon name="check" size={12} /> {t("done")}</span>}
                <button className="btn btn-sm" aria-pressed={ch.i_voted_hard} onClick={() => hard(ch.id)}>
                  <Icon name="star" size={14} className={ch.i_voted_hard ? "" : "muted"} /> {t("thisChapterIsHard")} · {ch.hard_votes}
                </button>
              </div>
            </div>
            {ch.summary && <div className="muted" style={{ marginTop: 4 }}><Rich text={ch.summary} /></div>}
            {ch.sections.map((s) => {
              const tr = responses.data?.filter((r) => r.section_id === s.id) ?? [];
              return (
                <div key={s.id} className="section-block stack" id={`section-${s.id}`}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <h3 style={{ margin: 0 }}>{s.title}</h3>
                    <Citations refs={s.citations} map={course.refs} />
                  </div>
                  <Rich as="div" text={s.content} />
                  {s.objectives.length > 0 && (
                    <div className="small"><strong>{t("objectives")}:</strong> {s.objectives.join(" · ")}</div>
                  )}
                  {s.key_terms.length > 0 && (
                    <div className="small">
                      <strong>{t("keyTerms")}</strong>
                      <ul className="term-list">{s.key_terms.map((k) => <li key={k.term}><strong><Rich text={k.term} /></strong> — <Rich text={k.definition} /></li>)}</ul>
                    </div>
                  )}
                  {s.formulas.length > 0 && (
                    <div className="small">
                      <strong>{t("formulas")}</strong>
                      <ul className="term-list">{s.formulas.map((f) => <li key={f.name}>{f.name}: <span className="formula"><Rich text={f.expression} /></span> {f.meaning && <span className="muted">— <Rich text={f.meaning} /></span>}</li>)}</ul>
                    </div>
                  )}
                  {s.hard_points.length > 0 && <div className="alert alert-warning small"><strong>{t("hardPoints")}:</strong> <Rich text={s.hard_points.join(" · ")} /></div>}
                  {tr.map((r) => (
                    <div key={r.id} className="alert alert-success small"><strong>{t("teacherResponses")} · {t(`kind_${r.kind}` as MessageKey)}:</strong> {r.body}</div>
                  ))}
                  <div className="row">
                    <button className="btn btn-sm" disabled={isDone(s.id)} onClick={() => complete(s.id)}>{isDone(s.id) ? <><Icon name="check" size={13} /> {t("done")}</> : t("markDone")}</button>
                    <ConfusionSignal section={s} />
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
