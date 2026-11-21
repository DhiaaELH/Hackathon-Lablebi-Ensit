import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { qk, useConversations, useInvalidate, useMessages } from "../api/hooks";
import type { MessagesPage } from "../api/types";
import { Icon } from "../components/Icon";
import { initials } from "../components/Layout";
import { useToast } from "../components/Toast";
import { Empty, Spinner } from "../components/ui";
import { useI18n } from "../i18n/I18n";

function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000);
}

function Thread({ id }: { id: string }) {
  const { t } = useI18n();
  const page = useMessages(id);
  const [older, setOlder] = useState<MessagesPage["messages"]>([]);
  const [hasMore, setHasMore] = useState<boolean | null>(null);
  const [body, setBody] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const invalidate = useInvalidate();
  const toast = useToast();
  const msgs = [...older, ...(page.data?.messages ?? [])];
  useEffect(() => { setOlder([]); setHasMore(null); }, [id]);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight }); }, [page.data?.messages.length]);

  async function loadOlder() {
    const first = msgs[0];
    if (!first) return;
    const r = await api.get<MessagesPage>(`/api/conversations/${id}/messages?before=${encodeURIComponent(first.at)}`);
    setOlder((o) => [...r.messages, ...o]);
    setHasMore(r.has_more);
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    try {
      await api.post(`/api/conversations/${id}/messages`, { body });
      setBody("");
      invalidate([...qk.messages(id)], [...qk.conversations]);
    } catch (err) {
      toast((err as Error).message, "err");
    }
  }
  if (page.isLoading) return <div className="card chat-box"><Spinner /></div>;
  const c = page.data?.conversation;
  return (
    <div className="card chat-box">
      <div className="nova-head">
        <span className="avatar">{c?.is_group ? <Icon name="users" size={16} /> : initials(c?.title ?? "?")}</span>
        <div style={{ flex: 1 }}>
          <strong>{c?.title}</strong>
          <div className="tiny muted">{c?.members.map((m) => m.display_name).join(", ")}</div>
        </div>
        {c?.exam_date && <span className="badge badge-warning"><Icon name="calendar" size={12} /> {t("examIn")} {daysUntil(c.exam_date)} {t("days")}</span>}
        {c?.course_id && <Link className="btn btn-sm" to={`/courses/${c.course_id}`}><Icon name="book" size={14} /></Link>}
      </div>
      <div className="chat-log" ref={logRef} aria-live="polite">
        {(hasMore ?? page.data?.has_more) && <button className="btn btn-sm btn-ghost" style={{ alignSelf: "center" }} onClick={loadOlder}>{t("loadOlder")}</button>}
        {msgs.map((m) => (
          <div key={m.id} className={`msg ${m.mine ? "msg-user" : "msg-bot"}`}>
            {c?.is_group && !m.mine && <div className="handoff">{m.sender}</div>}
            {m.body}
            <div className="tiny" style={{ opacity: 0.6, marginTop: 2 }}>{new Date(m.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
          </div>
        ))}
      </div>
      <form className="nova-foot" onSubmit={send}>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <input type="text" value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("typeMessage")} aria-label={t("typeMessage")} maxLength={4000} />
          <button className="btn btn-primary" type="submit"><Icon name="arrow" size={16} /></button>
        </div>
      </form>
    </div>
  );
}

export function Messages() {
  const { t } = useI18n();
  const { id } = useParams();
  const nav = useNavigate();
  const convs = useConversations();
  const active = id ?? convs.data?.[0]?.id;
  return (
    <div className="stack">
      <header className="page-head"><h1>{t("messages")}</h1></header>
      <div className="chat-layout">
        <div className="stack" style={{ gap: 2 }}>
          {convs.isLoading && <Spinner />}
          {convs.data?.length === 0 && <Empty>{t("noConversations")}</Empty>}
          {convs.data?.map((c) => (
            <button key={c.id} className={`conv-item${c.id === active ? " active" : ""}`} onClick={() => nav(`/messages/${c.id}`)}>
              <span className="avatar">{c.is_group ? <Icon name="users" size={16} /> : initials(c.title)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row between" style={{ flexWrap: "nowrap" }}>
                  <strong className="small" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</strong>
                  {c.unread > 0 && <span className="side-count">{c.unread}</span>}
                </div>
                <div className="tiny muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.last?.body ?? "—"}</div>
              </div>
            </button>
          ))}
        </div>
        {active ? <Thread id={active} /> : <Empty>{t("noConversations")}</Empty>}
      </div>
    </div>
  );
}
