import { useState, type FormEvent } from "react";
import { api } from "../api/client";
import { qk, useGroups, useInvalidate, useThread, useThreads } from "../api/hooks";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { useToast } from "../components/Toast";
import type { CourseDetail } from "../api/types";
import { Empty, ErrorBox, Spinner, Tabs } from "../components/ui";
import { useI18n } from "../i18n/I18n";
import { Rich } from "../components/Rich";

function ThreadView({ id, onBack }: { id: string; onBack: () => void }) {
  const { t } = useI18n();
  const th = useThread(id);
  const invalidate = useInvalidate();
  const [body, setBody] = useState("");
  const [err, setErr] = useState<unknown>(null);
  if (th.isLoading) return <Spinner />;
  if (!th.data) return <ErrorBox error={th.error} />;
  const refresh = () => invalidate([...qk.thread(id)]);
  async function act(fn: () => Promise<unknown>) {
    try { await fn(); refresh(); } catch (e) { setErr(e); }
  }
  async function reply(e: FormEvent) {
    e.preventDefault();
    await act(() => api.post(`/api/threads/${id}/posts`, { body }));
    setBody("");
  }
  return (
    <div className="stack">
      <button className="btn btn-sm btn-ghost" style={{ alignSelf: "flex-start" }} onClick={onBack}><Icon name="back" size={14} /> {t("threads")}</button>
      <div className="card stack">
        <h2 style={{ margin: 0 }}>{th.data.title}</h2>
        <span className="small muted">{th.data.author.display_name} · {th.data.author.role}</span>
        <Rich as="div" text={th.data.body} />
      </div>
      {th.data.posts.map((p) => (
        <div key={p.id} className="card stack" style={p.accepted ? { borderColor: "var(--success)" } : undefined}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="small"><strong>{p.author.display_name}</strong> {p.author.role === "senior" && <span className="badge badge-primary">tutor</span>} {p.author.role === "teacher" && <span className="badge badge-success">teacher</span>}</span>
            {p.accepted && <span className="badge badge-success"><Icon name="check" size={12} /> {t("accepted")}</span>}
          </div>
          <Rich as="div" text={p.body} />
          <div className="row small">
            <button className="btn btn-sm" aria-pressed={p.my_vote === 1} aria-label="upvote" onClick={() => act(() => api.post(`/api/posts/${p.id}/vote`, { value: p.my_vote === 1 ? 0 : 1 }))}><Icon name="up" size={14} /></button>
            <span>{p.score}</span>
            {th.data!.can_accept && !p.accepted && <button className="btn btn-sm" onClick={() => act(() => api.post(`/api/posts/${p.id}/accept`))}>{t("accept")}</button>}
            <button className="btn btn-sm btn-ghost" onClick={() => { const reason = prompt(t("report")); if (reason) act(() => api.post("/api/reports", { target_type: "post", target_id: p.id, reason })); }}>{t("report")}</button>
          </div>
        </div>
      ))}
      {err != null && <ErrorBox error={err} />}
      <form className="card stack" onSubmit={reply}>
        <label htmlFor="reply">{t("reply")}</label>
        <textarea id="reply" required value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 90 }} />
        <div><button className="btn btn-primary" type="submit">{t("reply")}</button></div>
      </form>
    </div>
  );
}

function Groups({ course }: { course: CourseDetail }) {
  const { t } = useI18n();
  const groups = useGroups(course.id);
  const invalidate = useInvalidate();
  const nav = useNavigate();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      const r = await api.post<{ id: string }>(`/api/courses/${course.id}/groups`, { title, exam_date: date || null });
      nav(`/messages/${r.id}`);
    } catch (err) { toast((err as Error).message, "err"); }
  }
  async function join(id: string) {
    await api.post(`/api/groups/${id}/join`);
    invalidate([...qk.groups(course.id)], [...qk.conversations]);
    nav(`/messages/${id}`);
  }
  const days = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
  return (
    <div className="stack">
      <form className="row card" onSubmit={create}>
        <input type="text" required minLength={2} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("newGroup")} aria-label={t("newGroup")} style={{ flex: 2, minWidth: 180 }} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t("examDate")} style={{ flex: 1, minWidth: 140 }} />
        <button className="btn btn-primary" type="submit"><Icon name="plus" size={14} /> {t("newGroup")}</button>
      </form>
      {groups.data?.length === 0 && <Empty>{t("nothingHere")}</Empty>}
      <div className="grid grid-2">
        {groups.data?.map((g) => (
          <div key={g.id} className="card card-hover stack">
            <strong>{g.title}</strong>
            <div className="row small">
              <span className="badge"><Icon name="users" size={12} /> {g.members} {t("members")}</span>
              {g.exam_date && <span className="badge badge-warning"><Icon name="calendar" size={12} /> {t("examIn")} {days(g.exam_date)} {t("days")}</span>}
            </div>
            {g.joined
              ? <button className="btn btn-sm" onClick={() => nav(`/messages/${g.id}`)}><Icon name="chat" size={14} /> {t("open")}</button>
              : <button className="btn btn-sm btn-primary" onClick={() => join(g.id)}>{t("join")}</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Community({ course, initialChapter }: { course: CourseDetail; initialChapter?: string | null }) {
  const { t } = useI18n();
  const [view, setView] = useState<"threads" | "groups">("threads");
  return (
    <div className="stack">
      <Tabs value={view} onChange={setView} tabs={[{ id: "threads", label: t("threads"), icon: "chat" }, { id: "groups", label: t("groups"), icon: "users" }]} />
      {view === "threads" ? <Threads course={course} initialChapter={initialChapter} /> : <Groups course={course} />}
    </div>
  );
}

function Threads({ course, initialChapter }: { course: CourseDetail; initialChapter?: string | null }) {
  const { t } = useI18n();
  const [chapter, setChapter] = useState(initialChapter ?? course.chapters[0]?.id ?? null);
  const [thread, setThread] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const threads = useThreads(chapter);
  const invalidate = useInvalidate();
  if (thread) return <ThreadView id={thread} onBack={() => { setThread(null); invalidate([...qk.threads(chapter ?? "")]); }} />;
  async function create(e: FormEvent) {
    e.preventDefault();
    const r = await api.post<{ id: string }>(`/api/chapters/${chapter}/threads`, { title, body });
    setCreating(false); setTitle(""); setBody("");
    setThread(r.id);
  }
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="row">
        <label htmlFor="chsel" className="sr-only">Chapter</label>
        <select id="chsel" value={chapter ?? ""} onChange={(e) => setChapter(e.target.value)} style={{ maxWidth: 420 }}>
          {course.chapters.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <button className="btn btn-primary btn-sm" onClick={() => setCreating((v) => !v)}><Icon name="plus" size={14} /> {t("newThread")}</button>
      </div>
      {creating && (
        <form className="card stack" onSubmit={create}>
          <div className="field"><label htmlFor="tt">{t("title")}</label><input id="tt" type="text" required minLength={3} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="field"><label htmlFor="tb">{t("body")}</label><textarea id="tb" required minLength={3} value={body} onChange={(e) => setBody(e.target.value)} /></div>
          <div><button className="btn btn-primary" type="submit">{t("send")}</button></div>
        </form>
      )}
      {threads.isLoading && <Spinner />}
      {threads.data?.length === 0 && <Empty>—</Empty>}
      {threads.data?.map((th) => (
        <button key={th.id} className="card stack" style={{ textAlign: "start", font: "inherit", cursor: "pointer", width: "100%" }} onClick={() => setThread(th.id)}>
          <strong>{th.title}</strong>
          <span className="row small muted">{th.author.display_name} · {th.replies} {t("replies")} {th.solved && <span className="badge badge-success">{t("solved")}</span>}</span>
        </button>
      ))}
    </div>
  );
}
