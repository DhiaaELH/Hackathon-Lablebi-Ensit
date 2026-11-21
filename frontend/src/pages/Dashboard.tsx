import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { qk, useCourses, useInvalidate } from "../api/hooks";
import type { CourseCard, Lang } from "../api/types";
import { Empty, ErrorBox, Spinner } from "../components/ui";
import { useI18n } from "../i18n/I18n";
import { LANG_LABEL } from "../i18n/messages";

export function CourseTile({ c, action }: { c: CourseCard; action?: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="card stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>{c.title}</h3>
      </div>
      <div className="row small">
        <span className={`badge ${c.visibility === "published" ? "badge-primary" : ""}`}>{c.visibility === "published" ? t("published") : t("private")}</span>
        {c.is_demo && <span className="badge badge-warning">{t("demo")}</span>}
        <span className="badge">{LANG_LABEL[c.language]}</span>
        <span className="muted">{c.chapter_count} ch.</span>
      </div>
      {c.description && <p className="muted small" style={{ margin: 0 }}>{c.description}</p>}
      <div className="row">{action ?? <Link className="btn btn-primary btn-sm" to={`/courses/${c.id}`}>{t("open")}</Link>}</div>
    </div>
  );
}

export function Dashboard() {
  const { t, lang } = useI18n();
  const courses = useCourses();
  const [title, setTitle] = useState("");
  const [cl, setCl] = useState<Lang>(lang);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const nav = useNavigate();
  const invalidate = useInvalidate();

  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      const c = await api.post<CourseCard>("/api/courses", { title, language: cl });
      await invalidate([...qk.courses]);
      nav(`/courses/${c.id}/setup`);
    } catch (e2) {
      setErr(e2);
    }
  }

  return (
    <div className="stack" style={{ gap: "1.25rem" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 className="hero-title">{t("myCourses")}</h1>
        <button className="btn btn-primary" onClick={() => setCreating((v) => !v)} aria-expanded={creating}>+ {t("newCourse")}</button>
      </div>
      {creating && (
        <form className="card stack" onSubmit={create}>
          <div className="field">
            <label htmlFor="ct">{t("courseTitle")}</label>
            <input id="ct" type="text" required minLength={2} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field" style={{ maxWidth: 260 }}>
            <label htmlFor="cl">{t("courseLanguage")}</label>
            <select id="cl" value={cl} onChange={(e) => setCl(e.target.value as Lang)}>
              {(Object.keys(LANG_LABEL) as Lang[]).map((l) => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}
            </select>
          </div>
          <p className="small muted" style={{ margin: 0 }}>{t("privateByDefault")}</p>
          {err != null && <ErrorBox error={err} />}
          <div className="row">
            <button className="btn btn-primary" type="submit">{t("create")}</button>
            <button className="btn" type="button" onClick={() => setCreating(false)}>{t("cancel")}</button>
          </div>
        </form>
      )}
      {courses.isLoading && <Spinner />}
      {courses.error && <ErrorBox error={courses.error} />}
      {courses.data && courses.data.length === 0 && <Empty>{t("noCourses")}</Empty>}
      <div className="grid grid-2">{courses.data?.map((c) => <CourseTile key={c.id} c={c} />)}</div>
    </div>
  );
}
