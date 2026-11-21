import { useState, type FormEvent } from "react";
import { api } from "../api/client";
import { qk, useExam, useExams, useInvalidate } from "../api/hooks";
import type { CourseDetail, ExamT } from "../api/types";
import { Icon } from "../components/Icon";
import { Rich } from "../components/Rich";
import { useToast } from "../components/Toast";
import { Empty, Spinner } from "../components/ui";
import { useI18n } from "../i18n/I18n";

function ExamDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { t } = useI18n();
  const e = useExam(id);
  const qc = useInvalidate();
  const toast = useToast();
  const [body, setBody] = useState("");
  if (!e.data) return <Spinner />;
  const set = () => qc([...qk.exam(id)]);
  async function vote(cid: string, v: number) {
    try { await api.post(`/api/exam-corrections/${cid}/vote`, { value: v }); set(); } catch (err) { toast((err as Error).message, "err"); }
  }
  async function add(ev: FormEvent) {
    ev.preventDefault();
    try { await api.post(`/api/exams/${id}/corrections`, { body }); setBody(""); set(); toast(t("toastSent")); } catch (err) { toast((err as Error).message, "err"); }
  }
  return (
    <div className="stack">
      <button className="btn btn-sm btn-ghost" style={{ alignSelf: "flex-start" }} onClick={onBack}><Icon name="back" size={14} /> {t("exams")}</button>
      <div className="card stack">
        <span className="eyebrow">{e.data.faculty} · {e.data.subject} · {e.data.year} · {e.data.session}</span>
        <h2 style={{ margin: 0 }}><Rich text={e.data.title} /></h2>
        <Rich as="div" text={e.data.content ?? ""} />
      </div>
      <h3>{t("corrections")}</h3>
      {e.data.correction_list?.length === 0 && <Empty>{t("nothingHere")}</Empty>}
      {e.data.correction_list?.map((c) => (
        <div key={c.id} className="card row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
          <div className="stack" style={{ alignItems: "center", gap: 2 }}>
            <button className="btn btn-sm btn-ghost btn-icon" disabled={c.mine} aria-pressed={c.my_vote === 1} aria-label="upvote" onClick={() => vote(c.id, c.my_vote === 1 ? 0 : 1)}><Icon name="up" size={16} /></button>
            <strong>{c.score}</strong>
            <button className="btn btn-sm btn-ghost btn-icon" disabled={c.mine} aria-pressed={c.my_vote === -1} aria-label="downvote" onClick={() => vote(c.id, c.my_vote === -1 ? 0 : -1)} style={{ transform: "rotate(180deg)" }}><Icon name="up" size={16} /></button>
          </div>
          <div style={{ flex: 1 }}><Rich as="div" text={c.body} /><div className="tiny muted">{c.author}</div></div>
        </div>
      ))}
      <form className="card stack" onSubmit={add}>
        <label htmlFor="corr">{t("addCorrection")}</label>
        <textarea id="corr" required minLength={10} value={body} onChange={(ev) => setBody(ev.target.value)} />
        <div><button className="btn btn-primary" type="submit">{t("send")}</button></div>
      </form>
    </div>
  );
}

export function ExamsTab({ course }: { course: CourseDetail }) {
  const { t } = useI18n();
  const [year, setYear] = useState("");
  const list = useExams(course.id, year);
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const invalidate = useInvalidate();
  const toast = useToast();
  const [f, setF] = useState({ faculty: "", subject: "", year: String(new Date().getFullYear()), session: "principale", title: "", content: "", chapter_ids: [] as string[], rights: false });
  if (open) return <ExamDetail id={open} onBack={() => setOpen(null)} />;
  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      const r = await api.post<ExamT>(`/api/courses/${course.id}/exams`, { ...f, year: Number(f.year), rights_confirmed: f.rights });
      invalidate(["exams", course.id]);
      setAdding(false);
      setOpen(r.id);
    } catch (err) { toast((err as Error).message, "err"); }
  }
  const years = Array.from(new Set(list.data?.exams.map((x) => x.year) ?? [])).sort((a, b) => b - a);
  const maxFreq = Math.max(1, ...(list.data?.chapter_frequency.map((c) => c.papers) ?? [1]));
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="row between">
        <div className="chips">
          <button className="chip" aria-pressed={year === ""} onClick={() => setYear("")}>{t("allYears")}</button>
          {years.map((y) => <button key={y} className="chip" aria-pressed={year === String(y)} onClick={() => setYear(String(y))}>{y}</button>)}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setAdding((v) => !v)}><Icon name="plus" size={14} /> {t("addExam")}</button>
      </div>
      {adding && (
        <form className="card grid grid-2" onSubmit={add}>
          <input type="text" required placeholder={t("faculty")} value={f.faculty} onChange={(e) => setF({ ...f, faculty: e.target.value })} />
          <input type="text" required placeholder={t("subject")} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
          <input type="number" required min={1990} max={2100} placeholder={t("year")} value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} />
          <select value={f.session} onChange={(e) => setF({ ...f, session: e.target.value })} aria-label={t("session")}>
            <option value="principale">principale</option><option value="contrôle">contrôle</option><option value="DS">DS</option>
          </select>
          <input type="text" required placeholder={t("title")} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} style={{ gridColumn: "1 / -1" }} />
          <textarea required minLength={10} placeholder="Énoncé (tapé par toi, pas de scan)" value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} style={{ gridColumn: "1 / -1" }} />
          <div className="chips" style={{ gridColumn: "1 / -1" }}>
            {course.chapters.map((c) => (
              <button type="button" key={c.id} className="chip" aria-pressed={f.chapter_ids.includes(c.id)}
                onClick={() => setF({ ...f, chapter_ids: f.chapter_ids.includes(c.id) ? f.chapter_ids.filter((x) => x !== c.id) : [...f.chapter_ids, c.id] })}>{c.title}</button>
            ))}
          </div>
          <label className="check small" style={{ gridColumn: "1 / -1" }}><input type="checkbox" checked={f.rights} onChange={(e) => setF({ ...f, rights: e.target.checked })} /> {t("rightsConfirm")}</label>
          <div><button className="btn btn-primary" disabled={!f.rights} type="submit">{t("save")}</button></div>
        </form>
      )}
      <div className="grid dash-top">
        <div className="stack">
          {list.isLoading && <Spinner />}
          {list.data?.exams.length === 0 && <Empty>{t("nothingHere")}</Empty>}
          {list.data?.exams.map((x) => (
            <button key={x.id} className="card card-hover stack" style={{ textAlign: "start", font: "inherit", cursor: "pointer", width: "100%", color: "inherit" }} onClick={() => setOpen(x.id)}>
              <span className="eyebrow">{x.year} · {x.session} · {x.faculty}</span>
              <strong>{x.title}</strong>
              <span className="tiny muted">{x.corrections} {t("corrections").toLowerCase()} · {x.uploader}</span>
            </button>
          ))}
        </div>
        <section className="card stack">
          <h3>{t("chapterFrequency")}</h3>
          {list.data?.chapter_frequency.map((c) => (
            <div key={c.chapter_id} className="bar-row">
              <span className="small" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.chapter}</span>
              <span className="progress-bar"><span style={{ width: `${(c.papers / maxFreq) * 100}%` }} /></span>
              <strong className="small">{c.papers}</strong>
            </div>
          ))}
          <span className="tiny muted">Plain counts of papers tagged with each chapter.</span>
        </section>
      </div>
    </div>
  );
}
