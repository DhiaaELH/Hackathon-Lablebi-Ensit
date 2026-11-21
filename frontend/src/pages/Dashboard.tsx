import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { qk, useCourses, useInvalidate, useMe, useRecs } from "../api/hooks";
import type { CourseCard, Lang } from "../api/types";
import { Icon } from "../components/Icon";
import { useToast } from "../components/Toast";
import { Empty, ErrorBox } from "../components/ui";
import { useI18n } from "../i18n/I18n";
import { LANG_LABEL } from "../i18n/messages";

export function CourseTile({ c, action }: { c: CourseCard; action?: ReactNode }) {
  const { t } = useI18n();
  const hue = [...c.title].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
  return (
    <div className="card card-hover stack" style={{ position: "relative", overflow: "hidden" }}>
      <div aria-hidden="true" style={{ position: "absolute", insetInlineEnd: -18, top: -18, width: 86, height: 86, borderRadius: "50%",
        background: `hsl(${hue} 30% 88%)`, opacity: 0.7 }} />
      <span className="eyebrow">{LANG_LABEL[c.language]} · {c.chapter_count} ch.</span>
      <h3 style={{ margin: 0, fontFamily: "var(--display)", fontSize: "1.12rem", position: "relative" }}>{c.title.replace("[DÉMO] ", "")}</h3>
      <div className="row small">
        <span className={`badge ${c.visibility === "published" ? "badge-primary" : ""}`}>
          <Icon name={c.visibility === "published" ? "library" : "lock"} size={12} /> {c.visibility === "published" ? t("published") : t("private")}
        </span>
        {c.is_demo && <span className="badge badge-warning">{t("demo")}</span>}
        {c.status === "processing" && <span className="badge badge-primary"><span className="spinner" style={{ width: 10, height: 10 }} /> {t("generating")}</span>}
      </div>
      {c.description && <p className="muted small" style={{ margin: 0 }}>{c.description}</p>}
      <div className="row" style={{ marginTop: "auto" }}>{action ?? <Link className="btn btn-primary btn-sm" to={`/courses/${c.id}`}>{t("open")} <Icon name="arrow" size={14} /></Link>}</div>
    </div>
  );
}

function Recommendations() {
  const { t } = useI18n();
  const recs = useRecs();
  const invalidate = useInvalidate();
  const toast = useToast();
  const [tuning, setTuning] = useState(false);
  if (recs.isLoading) return <div className="card stack"><div className="skeleton" style={{ width: "40%" }} /><div className="skeleton" /><div className="skeleton" /></div>;
  if (!recs.data) return null;
  async function fb(id: string, action: "saved" | "dismissed" | "none") {
    await api.post(`/api/recommendations/${id}/feedback`, { action });
    invalidate([...qk.recs]);
    toast(action === "dismissed" ? t("dismiss") : t("toastSaved"), "info");
  }
  async function tune(key: "review" | "next_steps" | "library") {
    await api.put("/api/recommendations/settings", { ...recs.data!.settings, [key]: !recs.data!.settings[key] });
    invalidate([...qk.recs]);
  }
  const link = (r: (typeof recs.data.items)[number]) => `/courses/${r.course_id}${r.section_id ? `?section=${r.section_id}` : ""}`;
  return (
    <section className="card stack" aria-labelledby="recs-title">
      <div className="row between">
        <h2 id="recs-title" style={{ margin: 0 }}>{t("forYou")}</h2>
        <button className="btn btn-sm btn-ghost" aria-expanded={tuning} onClick={() => setTuning((v) => !v)}><Icon name="gear" size={15} /> {t("tune")}</button>
      </div>
      {tuning && (
        <div className="stack small" style={{ background: "var(--paper)", padding: "0.7rem", borderRadius: 10 }}>
          <div className="chips">
            {([["review", t("recReview")], ["next_steps", t("recNext")], ["library", t("recLibrary")]] as const).map(([k, label]) => (
              <button key={k} className="chip" aria-pressed={recs.data!.settings[k]} onClick={() => tune(k)}>{label}</button>
            ))}
          </div>
          <span className="muted tiny">{t("recHow")}: {recs.data.how}</span>
        </div>
      )}
      {recs.data.items.length === 0 && <p className="muted small" style={{ margin: 0 }}>{t("noRecs")}</p>}
      {recs.data.items.slice(0, 5).map((r) => (
        <div key={r.id} className="row" style={{ borderTop: "1px solid var(--line)", paddingTop: "0.6rem", alignItems: "flex-start", flexWrap: "nowrap" }}>
          <span className="avatar" style={{ background: r.type === "concept" ? "var(--warning-soft)" : undefined, color: r.type === "concept" ? "var(--warning)" : undefined, borderColor: "transparent" }}>
            <Icon name={r.type === "concept" ? "target" : r.type === "section" ? "arrow" : "compass"} size={16} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Link to={link(r)} style={{ fontWeight: 600, color: "var(--ink)" }}>{r.title}</Link>
            <div className="small muted"><span className="eyebrow" style={{ marginInlineEnd: 6 }}>{t("whySuggested")}</span>{r.reason}</div>
          </div>
          <button className="btn btn-sm btn-ghost btn-icon" aria-pressed={r.saved} aria-label={t("saveIt")} title={t("saveIt")} onClick={() => fb(r.id, r.saved ? "none" : "saved")}>
            <Icon name="bookmark" size={16} className={r.saved ? "" : "muted"} />
          </button>
          <button className="btn btn-sm btn-ghost btn-icon" aria-label={t("dismiss")} title={t("dismiss")} onClick={() => fb(r.id, "dismissed")}><Icon name="x" size={16} /></button>
        </div>
      ))}
    </section>
  );
}

export function Dashboard() {
  const { t, lang } = useI18n();
  const me = useMe();
  const courses = useCourses();
  const [title, setTitle] = useState("");
  const [cl, setCl] = useState<Lang>(lang);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const nav = useNavigate();
  const invalidate = useInvalidate();
  const first = me.data?.display_name.replace(/\(.*?\)/g, "").trim().split(" ")[0];
  const recent = courses.data?.[0];

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
    <div className="stack" style={{ gap: "1.4rem" }}>
      <header className="page-head">
        <div>
          <span className="eyebrow">{new Date().toLocaleDateString(lang === "derja" ? "ar-TN" : lang, { weekday: "long", day: "numeric", month: "long" })}</span>
          <h1 style={{ margin: "0.2rem 0 0" }}>{t("hello")}{first ? `, ${first}` : ""}.</h1>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating((v) => !v)} aria-expanded={creating}><Icon name="plus" size={16} /> {t("newCourse")}</button>
      </header>

      {creating && (
        <form className="card stack" onSubmit={create} style={{ maxWidth: 620 }}>
          <div className="field">
            <label htmlFor="ct">{t("courseTitle")}</label>
            <input id="ct" type="text" required minLength={2} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="field" style={{ maxWidth: 260 }}>
            <label htmlFor="cl">{t("courseLanguage")}</label>
            <select id="cl" value={cl} onChange={(e) => setCl(e.target.value as Lang)}>
              {(Object.keys(LANG_LABEL) as Lang[]).map((l) => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}
            </select>
          </div>
          <p className="small muted" style={{ margin: 0 }}><Icon name="lock" size={13} /> {t("privateByDefault")}</p>
          {err != null && <ErrorBox error={err} />}
          <div className="row">
            <button className="btn btn-primary" type="submit">{t("create")}</button>
            <button className="btn" type="button" onClick={() => setCreating(false)}>{t("cancel")}</button>
          </div>
        </form>
      )}

      <div className="grid dash-top">
        {recent ? (
          <Link to={`/courses/${recent.id}`} className="card card-hover stack" style={{ color: "inherit", textDecoration: "none", background: "var(--ink)", borderColor: "var(--ink)" }}>
            <span className="eyebrow" style={{ color: "#a9b8b5" }}>{t("continueLearning")}</span>
            <h2 style={{ color: "var(--paper)", margin: 0, fontSize: "1.6rem" }}>{recent.title.replace("[DÉMO] ", "")}</h2>
            <span className="small" style={{ color: "#c9d3d1" }}>{recent.chapter_count} ch. · Nova · {t("practice")} · {t("revision")} · {t("community")}</span>
            <span className="btn btn-accent btn-sm" style={{ alignSelf: "flex-start", marginTop: "0.6rem" }}>{t("open")} <Icon name="arrow" size={14} /></span>
          </Link>
        ) : <div />}
        <Recommendations />
      </div>

      <section className="stack">
        <div className="row between"><h2 style={{ margin: 0 }}>{t("myCourses")}</h2></div>
        {courses.isLoading && <div className="grid grid-2">{[0, 1, 2].map((i) => <div key={i} className="card skeleton" style={{ height: 150 }} />)}</div>}
        {courses.error && <ErrorBox error={courses.error} />}
        {courses.data && courses.data.length === 0 && <Empty>{t("noCourses")}</Empty>}
        <div className="grid grid-2">{courses.data?.map((c) => <CourseTile key={c.id} c={c} />)}</div>
      </section>
    </div>
  );
}
