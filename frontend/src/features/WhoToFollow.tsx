import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { qk, useInvalidate, useSuggestions } from "../api/hooks";
import type { ConversationT } from "../api/types";
import { Icon } from "../components/Icon";
import { initials } from "../components/Layout";
import { useToast } from "../components/Toast";
import { useI18n } from "../i18n/I18n";
import type { MessageKey } from "../i18n/messages";

/** Rule-based people suggestions with the reason shown; follow / message / dismiss inline. */
export function WhoToFollow({ limit = 4, compact }: { limit?: number; compact?: boolean }) {
  const { t, tf } = useI18n();
  const sugg = useSuggestions();
  const why = (r: { code: string; args: Record<string, string | number> }) =>
    r.code === "peer_tutor" && Number(r.args.answers) > 0 ? `${t("s_peer_tutor")} · ${tf("s_peer_answers", r.args)}` : tf(`s_${r.code}` as MessageKey, r.args);
  const invalidate = useInvalidate();
  const toast = useToast();
  const nav = useNavigate();
  if (sugg.isLoading) return <div className="card stack"><div className="skeleton" style={{ width: "40%" }} /><div className="skeleton" /></div>;
  const items = sugg.data?.slice(0, limit) ?? [];
  if (!items.length) return null;
  async function act(fn: () => Promise<unknown>, msg?: string) {
    try {
      await fn();
      if (msg) toast(msg);
      invalidate([...qk.suggestions], ["people"]);
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }
  async function message(username: string) {
    try {
      const c = await api.post<ConversationT>("/api/conversations", { username });
      nav(`/messages/${c.id}`);
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }
  return (
    <section className="card stack" aria-labelledby="wtf-title">
      <h2 id="wtf-title" style={{ margin: 0 }}>{t("whoToFollow")}</h2>
      <div className={compact ? "stack" : "grid grid-2"} style={{ gap: compact ? 0 : "0.8rem" }}>
        {items.map((p) => (
          <div key={p.username} className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start", borderTop: compact ? "1px solid var(--line)" : undefined, paddingTop: compact ? "0.6rem" : 0, marginTop: compact ? "0.6rem" : 0 }}>
            <span className="avatar">{initials(p.display_name)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row" style={{ gap: "0.35rem" }}>
                <strong className="small">{p.display_name}</strong>
                {p.badge === "peer_tutor" && <span className="badge badge-primary" style={{ fontSize: "0.8rem" }}><Icon name="star" size={10} /> {t("peerTutor")}</span>}
              </div>
              <div className="tiny muted">{p.reasons?.length ? p.reasons.map(why).join(" · ") : p.reason}</div>
              <div className="row" style={{ marginTop: 6, gap: "0.35rem" }}>
                <button className="btn btn-sm btn-primary" onClick={() => act(() => api.post(`/api/users/${p.username}/follow`), `${t("follow")} · ${p.display_name}`)}>{t("follow")}</button>
                {p.can_message && <button className="btn btn-sm" onClick={() => message(p.username)} aria-label={t("message")}><Icon name="chat" size={13} /></button>}
              </div>
            </div>
            <button className="btn btn-sm btn-ghost btn-icon" aria-label={t("dismiss")} title={t("dismiss")}
              onClick={() => act(() => api.post(`/api/users/${p.username}/dismiss-suggestion`))}><Icon name="x" size={14} /></button>
          </div>
        ))}
      </div>
    </section>
  );
}
