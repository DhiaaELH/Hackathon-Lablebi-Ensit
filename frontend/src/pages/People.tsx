import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { qk, useInvalidate, usePeople, useQuery } from "../api/hooks";
import type { ConversationT, PublicProfile } from "../api/types";
import { Icon } from "../components/Icon";
import { initials } from "../components/Layout";
import { useToast } from "../components/Toast";
import { Empty, ErrorBox, Spinner } from "../components/ui";
import { useI18n } from "../i18n/I18n";

export function ProfileCard({ p, onChange }: { p: PublicProfile; onChange?: () => void }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const invalidate = useInvalidate();
  async function act(fn: () => Promise<unknown>, msg?: string) {
    try {
      await fn();
      if (msg) toast(msg);
      invalidate(["people"], [...qk.profile(p.username)]);
      onChange?.();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }
  async function message() {
    try {
      const c = await api.post<ConversationT>("/api/conversations", { username: p.username });
      nav(`/messages/${c.id}`);
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }
  return (
    <div className="card card-hover stack">
      <div className="row" style={{ flexWrap: "nowrap" }}>
        <span className="avatar" style={{ width: 44, height: 44, fontSize: "1rem" }}>{initials(p.display_name)}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600 }}>{p.display_name}</div>
          <div className="tiny muted">@{p.username} · {p.role}</div>
        </div>
      </div>
      {p.bio && <p className="small" style={{ margin: 0 }}>{p.bio}</p>}
      <div className="row tiny">
        {p.badge === "peer_tutor" && <span className="badge badge-primary"><Icon name="star" size={12} /> {t("peerTutor")}</span>}
        {p.accepted_answers > 0 && <span className="badge">{p.accepted_answers} {t("acceptedAnswers")}</span>}
        {p.follows_you && <span className="badge">{t("followsYou")}</span>}
        {p.followers !== undefined && <span className="muted">{p.followers} followers</span>}
      </div>
      {!p.is_me && (
        <div className="row">
          {p.blocked_by_me ? (
            <button className="btn btn-sm" onClick={() => act(() => api.del(`/api/users/${p.username}/block`), t("unblock"))}>{t("unblock")}</button>
          ) : (
            <>
              <button className={`btn btn-sm ${p.following ? "" : "btn-primary"}`}
                onClick={() => act(() => (p.following ? api.del(`/api/users/${p.username}/follow`) : api.post(`/api/users/${p.username}/follow`)))}>
                {p.following ? t("unfollow") : t("follow")}
              </button>
              <button className="btn btn-sm" disabled={!p.can_message} title={p.can_message ? "" : "Messages are restricted by this user's privacy settings"} onClick={message}>
                <Icon name="chat" size={14} /> {t("message")}
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => { if (confirm(`${t("block")} ${p.display_name}?`)) act(() => api.post(`/api/users/${p.username}/block`), t("block")); }}>{t("block")}</button>
              <button className="btn btn-sm btn-ghost" onClick={() => { const reason = prompt(t("report")); if (reason) act(() => api.post("/api/reports", { target_type: "user", target_id: p.username, reason }), t("toastSent")); }}>
                <Icon name="flag" size={14} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function People() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(id);
  }, [q]);
  const people = usePeople(debounced);
  return (
    <div className="stack" style={{ gap: "1.1rem" }}>
      <header className="page-head"><div><h1>{t("people")}</h1><p>{t("searchOptIn")}</p></div></header>
      <div className="row" style={{ maxWidth: 520, flexWrap: "nowrap" }}>
        <Icon name="search" className="muted" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPeople")} aria-label={t("searchPeople")} autoFocus />
      </div>
      {people.isFetching && <Spinner />}
      {people.error && <ErrorBox error={people.error} />}
      {debounced.length >= 2 && people.data?.length === 0 && <Empty>{t("nothingHere")}</Empty>}
      {debounced.length < 2 && <Empty>{t("searchPeople")} — try “you”, “am”</Empty>}
      <div className="grid grid-3">{people.data?.map((p) => <ProfileCard key={p.username} p={p} />)}</div>
    </div>
  );
}

export function ProfilePage() {
  const { username = "" } = useParams();
  const p = useQuery({ queryKey: qk.profile(username), queryFn: () => api.get<PublicProfile>(`/api/users/${username}`) });
  if (p.isLoading) return <Spinner />;
  if (!p.data) return <ErrorBox error={p.error} />;
  return <div style={{ maxWidth: 420 }}><ProfileCard p={p.data} onChange={() => p.refetch()} /></div>;
}
