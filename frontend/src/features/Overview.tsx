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
  const nSections = course.chapters.reduce((n, ch) => n + ch.sections.length, 0);
  const nDone = course.chapters.reduce((n, ch) => n + ch.sections.filter((s) => isDone(s.id)).length, 0);
  const goto = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const notes = course.analysis_notes?.missing_or_ambiguous ?? [];
  return (
    <div className="overview">
      <div className="ov-progress" title={t("criteriaText")}>
        <span className="ov-progress-label">{t("progress")}</span>
        <ProgressBar value={nSections ? nDone / nSections : 0} label={t("progress")} />
        <span className="ov-progress-count">{p ? p.sections_done : nDone}/{p ? p.sections_total : nSections} {t("sectionsDone")}</span>
      </div>
      <p className="ov-criteria">{t("criteriaText")}</p>

      <details className="outline">
        <summary>
          <Icon name="book" size={15} /> <span className="outline-title">{t("outline")}</span>
          <span className="outline-meta">{course.chapters.length} {t("chaptersShort")} · {nSections} {t("sectionsShort")}</span>
        </summary>
        <ol className="outline-list">
          {course.chapters.map((ch) => (
            <li key={ch.id}>
              <a href={`#ch-${ch.id}`} className="outline-ch" onClick={(e) => { e.preventDefault(); goto(`chapter-${ch.id}`); }}><Rich text={ch.title} /></a>
              <ol>
                {ch.sections.map((s) => (
                  <li key={s.id} className={isDone(s.id) ? "is-done" : undefined}>
                    <a href={`#section-${s.id}`} onClick={(e) => { e.preventDefault(); goto(`section-${s.id}`); }}>
                      <span className="outline-dot" aria-hidden="true">{isDone(s.id) ? <Icon name="check" size={11} /> : null}</span>
                      <Rich text={s.title} />
                    </a>
                  </li>
                ))}
              </ol>
            </li>
          ))}
        </ol>
      </details>

      {notes.length > 0 && (
        <details className="clara-note">
          <summary><Icon name="spark" size={14} /> {t("missing")} <span className="muted">· Clara · {notes.length}</span></summary>
          <ul>{notes.map((n, i) => <li key={i}><Rich text={n} /></li>)}</ul>
        </details>
      )}

      {course.chapters.map((ch) => {
        const chProg = p?.chapters.find((c) => c.chapter_id === ch.id);
        return (
          <section key={ch.id} id={`chapter-${ch.id}`} className="card chapter" aria-labelledby={`ch-${ch.id}`}>
            <header className="chapter-head">
              <div className="chapter-titles">
                <h2 id={`ch-${ch.id}`}><Rich text={ch.title} /></h2>
                {ch.summary && <Rich as="p" className="chapter-summary" text={ch.summary} />}
              </div>
              <div className="chapter-tools">
                {chProg?.complete && <span className="badge badge-success"><Icon name="check" size={12} /> {t("done")}</span>}
                <button className="btn btn-sm btn-quiet" aria-pressed={ch.i_voted_hard} onClick={() => hard(ch.id)} title={t("thisChapterIsHard")}>
                  <Icon name="star" size={14} className={ch.i_voted_hard ? "" : "muted"} /> <span className="hide-sm">{t("thisChapterIsHard")}</span> <span className="count">{ch.hard_votes}</span>
                </button>
              </div>
            </header>
            {ch.sections.map((s) => {
              const tr = responses.data?.filter((r) => r.section_id === s.id) ?? [];
              const done = isDone(s.id);
              return (
                <article key={s.id} className={`section-block${done ? " is-done" : ""}`} id={`section-${s.id}`}>
                  <header className="section-head">
                    <h3><Rich text={s.title} /></h3>
                    <Citations refs={s.citations} map={course.refs} />
                  </header>
                  <Rich as="div" className="prose" text={s.content} />
                  {s.objectives.length > 0 && (
                    <div className="sec-part">
                      <div className="sec-label">{t("objectives")}</div>
                      <ul className="obj-list">{s.objectives.map((o, i) => <li key={i}><Rich text={o} /></li>)}</ul>
                    </div>
                  )}
                  {s.key_terms.length > 0 && (
                    <div className="sec-part">
                      <div className="sec-label">{t("keyTerms")}</div>
                      <dl className="terms">{s.key_terms.map((k) => (
                        <div key={k.term} className="term"><dt><Rich text={k.term} /></dt><dd><Rich text={k.definition} /></dd></div>
                      ))}</dl>
                    </div>
                  )}
                  {s.formulas.length > 0 && (
                    <div className="sec-part">
                      <div className="sec-label">{t("formulas")}</div>
                      <div className="formulas">{s.formulas.map((f) => (
                        <div key={f.name} className="formula-card">
                          <span className="formula-name"><Rich text={f.name} /></span>
                          <span className="formula"><Rich text={f.expression} math /></span>
                          {f.meaning && <span className="formula-meaning"><Rich text={f.meaning} /></span>}
                        </div>
                      ))}</div>
                    </div>
                  )}
                  {s.hard_points.length > 0 && (
                    <div className="alert alert-warning small hard-points">
                      <strong>{t("hardPoints")}</strong>
                      <ul>{s.hard_points.map((h, i) => <li key={i}><Rich text={h} /></li>)}</ul>
                    </div>
                  )}
                  {tr.map((r) => (
                    <div key={r.id} className="alert alert-success small"><strong>{t("teacherResponses")} · {t(`kind_${r.kind}` as MessageKey)} :</strong> <Rich text={r.body} /></div>
                  ))}
                  <footer className="section-actions">
                    <button className={`btn btn-sm${done ? " btn-done" : ""}`} disabled={done} onClick={() => complete(s.id)}>{done ? <><Icon name="check" size={13} /> {t("done")}</> : t("markDone")}</button>
                    <ConfusionSignal section={s} />
                  </footer>
                </article>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
