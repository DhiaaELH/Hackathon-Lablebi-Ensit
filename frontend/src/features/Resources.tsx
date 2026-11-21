import { useState, type FormEvent } from "react";
import { api } from "../api/client";
import { qk, useGlossary, useInvalidate, useMe, useShared } from "../api/hooks";
import type { CourseDetail, FinderResult } from "../api/types";
import { Icon } from "../components/Icon";
import { Rich } from "../components/Rich";
import { useToast } from "../components/Toast";
import { Empty, ErrorBox, Spinner, Tabs } from "../components/ui";
import { useI18n } from "../i18n/I18n";
import { texToPlain } from "../components/Rich";

function Shared({ course }: { course: CourseDetail }) {
  const { t } = useI18n();
  const [chapter, setChapter] = useState(course.chapters[0]?.id ?? null);
  const list = useShared(chapter);
  const invalidate = useInvalidate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("note");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [rights, setRights] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post(`/api/chapters/${chapter}/shared`, { kind, title, body: kind === "video_url" ? null : body, url: kind === "video_url" ? url : null, rights_confirmed: rights });
      setOpen(false); setTitle(""); setBody(""); setUrl(""); setRights(false);
      invalidate([...qk.shared(chapter ?? "")]);
      toast(t("toastSent"));
    } catch (err) {
      toast((err as Error).message, "err");
    }
  }
  async function rate(id: string, helpful: boolean | null) {
    try { await api.post(`/api/shared/${id}/rate`, { helpful }); invalidate([...qk.shared(chapter ?? "")]); } catch (err) { toast((err as Error).message, "err"); }
  }
  return (
    <div className="stack">
      <div className="row">
        <select value={chapter ?? ""} onChange={(e) => setChapter(e.target.value)} style={{ maxWidth: 380 }} aria-label="Chapter">
          {course.chapters.map((c) => <option key={c.id} value={c.id}>{texToPlain(c.title)}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={() => setOpen((v) => !v)}><Icon name="plus" size={14} /> {t("share")}</button>
      </div>
      {open && (
        <form className="card stack" onSubmit={submit}>
          <div className="chips" role="radiogroup">
            {["note", "summary", "solved_exercise", "video_url"].map((k) => <button type="button" key={k} className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>{k.replace("_", " ")}</button>)}
          </div>
          <input type="text" required minLength={3} placeholder={t("title")} value={title} onChange={(e) => setTitle(e.target.value)} aria-label={t("title")} />
          {kind === "video_url"
            ? <input type="url" required placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="URL" />
            : <textarea required value={body} onChange={(e) => setBody(e.target.value)} aria-label={t("body")} placeholder="$...$ pour les formules" />}
          <label className="check small"><input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} /> {t("copyright")}</label>
          <div><button className="btn btn-primary" disabled={!rights} type="submit">{t("share")}</button></div>
        </form>
      )}
      {list.isLoading && <Spinner />}
      {list.data?.length === 0 && <Empty>{t("nothingHere")}</Empty>}
      {list.data?.map((r) => (
        <article key={r.id} className="card stack">
          <div className="row between">
            <div className="row"><span className="badge">{r.kind.replace("_", " ")}</span><strong>{r.title}</strong></div>
            <span className="tiny muted">{r.author}</span>
          </div>
          {r.body && <Rich as="div" text={r.body} />}
          {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="small"><Icon name="link" size={13} /> {new URL(r.url).hostname}</a>}
          <div className="row small">
            <button className="btn btn-sm" disabled={r.mine} aria-pressed={r.my_rating === true} onClick={() => rate(r.id, r.my_rating === true ? null : true)}><Icon name="up" size={13} /> {t("helpful")} · {r.helpful}</button>
            <button className="btn btn-sm btn-ghost" disabled={r.mine} aria-pressed={r.my_rating === false} onClick={() => rate(r.id, r.my_rating === false ? null : false)}>{t("notHelpful")} · {r.not_helpful}</button>
            <button className="btn btn-sm btn-ghost" onClick={async () => { const reason = prompt(t("report")); if (reason) { await api.post("/api/reports", { target_type: "resource", target_id: r.id, reason }); toast(t("toastSent")); } }}><Icon name="flag" size={13} /></button>
            {r.mine && <button className="btn btn-sm btn-ghost btn-danger" style={{ marginInlineStart: "auto" }} onClick={async () => { if (confirm(t("confirmDelete"))) { await api.del(`/api/shared/${r.id}`); await list.refetch(); toast(t("removedOk")); } }}><Icon name="trash" size={13} /> {t("deleteIt")}</button>}
          </div>
        </article>
      ))}
    </div>
  );
}

function Finder({ course }: { course: CourseDetail }) {
  const { t, lang } = useI18n();
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<FinderResult | null>(null);
  const [err, setErr] = useState<unknown>(null);
  async function go(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { setRes(await api.post<FinderResult>(`/api/courses/${course.id}/resource-finder`, { topic, language: lang }, 90_000)); }
    catch (e2) { setErr(e2); }
    finally { setBusy(false); }
  }
  const suggestions = course.concepts.slice(0, 5).map((c) => c.name);
  return (
    <div className="stack">
      <form className="row" onSubmit={go} style={{ flexWrap: "nowrap" }}>
        <input type="search" required minLength={2} value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t("findFor")} aria-label={t("findFor")} />
        <button className="btn btn-primary" disabled={busy} type="submit">{busy ? <span className="spinner" /> : <Icon name="search" size={15} />} {t("find")}</button>
      </form>
      <div className="suggest">{suggestions.map((s) => <button key={s} className="chip" onClick={() => setTopic(s)}>{s}</button>)}</div>
      {err != null && <ErrorBox error={err} />}
      {res && !res.available && <div className="alert alert-warning small">{res.reason}</div>}
      {res?.available && res.results.length === 0 && <Empty>{res.reason}</Empty>}
      {res?.available && res.results.length > 0 && <span className="tiny muted">{t("verifiedLinks")}</span>}
      {res?.results.map((r) => (
        <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="card card-hover stack" style={{ color: "inherit", textDecoration: "none" }}>
          <div className="row between"><strong>{r.title}</strong><span className="badge"><Icon name="link" size={12} /> {r.provider}</span></div>
          {r.reason && <span className="small muted">{r.reason}</span>}
        </a>
      ))}
    </div>
  );
}

function Glossary({ course }: { course: CourseDetail }) {
  const { t } = useI18n();
  const me = useMe();
  const [q, setQ] = useState("");
  const g = useGlossary(course.id, q);
  const invalidate = useInvalidate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ term_fr: "", term_ar: "", term_derja: "", term_en: "", explanation: "", example: "" });
  const reviewer = me.data && ["senior", "teacher", "admin"].includes(me.data.role);
  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post(`/api/courses/${course.id}/glossary`, Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v || null])));
      setOpen(false);
      setForm({ term_fr: "", term_ar: "", term_derja: "", term_en: "", explanation: "", example: "" });
      invalidate(["glossary", course.id]);
      toast(t("toastSaved"));
    } catch (err) { toast((err as Error).message, "err"); }
  }
  return (
    <div className="stack">
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")} />
        <button className="btn btn-primary btn-sm" onClick={() => setOpen((v) => !v)}><Icon name="plus" size={14} /> {t("addTerm")}</button>
      </div>
      {open && (
        <form className="card grid grid-2" onSubmit={add}>
          {(["term_fr", "term_ar", "term_derja", "term_en"] as const).map((k) => (
            <input key={k} type="text" required={k === "term_fr"} placeholder={{ term_fr: "Français *", term_ar: "العربية", term_derja: "الدارجة", term_en: "English" }[k]}
              dir={k === "term_ar" || k === "term_derja" ? "rtl" : undefined} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          ))}
          <textarea required minLength={3} placeholder="Explication *" value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} style={{ gridColumn: "1 / -1", minHeight: 80 }} />
          <input type="text" placeholder={t("examples")} value={form.example} onChange={(e) => setForm({ ...form, example: e.target.value })} style={{ gridColumn: "1 / -1" }} />
          <div><button className="btn btn-primary" type="submit">{t("save")}</button></div>
        </form>
      )}
      {g.isLoading && <Spinner />}
      {g.data?.length === 0 && <Empty>{t("nothingHere")}</Empty>}
      <div className="table-wrap card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>FR</th><th>العربية</th><th>الدارجة</th><th>EN</th><th>{t("body")}</th><th /></tr></thead>
          <tbody>
            {g.data?.map((x) => (
              <tr key={x.id}>
                <td><strong>{x.term_fr}</strong></td><td dir="rtl">{x.term_ar ?? "—"}</td><td dir="rtl">{x.term_derja ?? "—"}</td><td>{x.term_en ?? "—"}</td>
                <td className="small"><Rich text={x.explanation} />{x.example && <div className="muted tiny">{t("examples")}: {x.example}</div>}</td>
                <td>
                  {x.review_state === "reviewed" ? <span className="badge badge-success"><Icon name="check" size={12} /> {t("reviewed")}</span>
                    : reviewer ? <button className="btn btn-sm" onClick={async () => { await api.post(`/api/glossary/${x.id}/review`); invalidate(["glossary", course.id]); }}>{t("markReviewed")}</button>
                    : <span className="badge">{t("pending")}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <span className="tiny muted">{t("glossaryCheck")}</span>
    </div>
  );
}

export function ResourcesTab({ course }: { course: CourseDetail }) {
  const { t } = useI18n();
  const [view, setView] = useState<"shared" | "finder" | "glossary">("shared");
  return (
    <div className="stack">
      <Tabs value={view} onChange={setView} tabs={[
        { id: "shared", label: t("sharedByStudents"), icon: "users" }, { id: "finder", label: t("resourceFinder"), icon: "compass" }, { id: "glossary", label: t("glossary"), icon: "book" },
      ]} />
      {view === "shared" && <Shared course={course} />}
      {view === "finder" && <Finder course={course} />}
      {view === "glossary" && <Glossary course={course} />}
    </div>
  );
}
