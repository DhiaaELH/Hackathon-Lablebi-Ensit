import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useConversations, useHealth, useMe, useNotifications, useQueryClient } from "../api/hooks";
import type { Lang } from "../api/types";
import { useI18n } from "../i18n/I18n";
import { LANG_LABEL, type MessageKey } from "../i18n/messages";
import { Icon } from "./Icon";

export function LanguageSwitch({ compact }: { compact?: boolean }) {
  const { lang, setLang, t } = useI18n();
  return (
    <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label={t("language")} style={compact ? { width: "auto", padding: "0.3rem 0.5rem" } : undefined}>
      {(Object.keys(LANG_LABEL) as Lang[]).map((l) => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}
    </select>
  );
}

export const initials = (name: string) =>
  name.replace(/\(.*?\)|\[.*?\]/g, "").trim().split(/\s+/).filter((w) => /\p{L}/u.test(w)).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

export function Layout() {
  const { t } = useI18n();
  const me = useMe();
  const health = useHealth();
  const notes = useNotifications(!!me.data);
  const convs = useConversations();
  const qc = useQueryClient();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [loc.pathname]);
  const role = me.data?.role;
  const unread = notes.data?.filter((n) => !n.read).length ?? 0;
  const unreadMsgs = convs.data?.reduce((s, c) => s + c.unread, 0) ?? 0;

  async function signOut() {
    await api.post("/api/auth/logout");
    qc.clear();
    nav("/login");
  }
  const link = (to: string, icon: string, key: MessageKey, count?: number, end?: boolean) => (
    <NavLink to={to} end={end} className={({ isActive }) => `side-link${isActive ? " active" : ""}`}>
      <Icon name={icon} /> {t(key)} {count ? <span className="side-count">{count}</span> : null}
    </NavLink>
  );

  return (
    <>
      {health.data?.demo_mode && <div className="demo-banner" role="note">{t("demoMode")}</div>}
      <div className="mobile-bar">
        <button className="btn btn-ghost btn-icon" onClick={() => setOpen(true)} aria-label="Menu"><Icon name="layers" /></button>
        <span className="brand-name">LessonForge</span>
      </div>
      <div className={`scrim${open ? " open" : ""}`} onClick={() => setOpen(false)} />
      <div className="shell">
        <aside className={`sidebar${open ? " open" : ""}`} aria-label="Main">
          <NavLink to="/" className="brand">
            <span className="brand-mark" aria-hidden="true">L</span>
            <span><span className="brand-name">LessonForge</span><span className="brand-tag">{t("appTagline")}</span></span>
          </NavLink>
          {link("/", "book", "home", undefined, true)}
          {link("/library", "library", "library")}
          {link("/people", "users", "people")}
          {link("/messages", "chat", "messages", unreadMsgs)}
          {link("/community", "forum", "community")}
          {link("/challenges", "star", "challenges")}
          {link("/notifications", "bell", "notifications", unread)}
          {(role === "teacher" || role === "admin" || role === "senior") && <div className="side-sep" />}
          {(role === "teacher" || role === "admin") && link("/insights", "pulse", "insights")}
          {(role === "senior" || role === "teacher" || role === "admin") && link("/queue", "target", "seniorQueue")}
          {role === "admin" && link("/moderation", "shield", "moderation")}
          <div className="side-foot">
            <LanguageSwitch />
            {me.data && (
              <div className="me-chip">
                <span className="avatar">{initials(me.data.display_name)}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="small" style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{me.data.display_name}</div>
                  <div className="tiny muted" title={t(`roleHint_${me.data.role}` as MessageKey)}>@{me.data.username} · {t(`role_${me.data.role}` as MessageKey)}</div>
                </div>
              </div>
            )}
            <div className="row">
              <NavLink to="/settings" className="btn btn-sm btn-ghost"><Icon name="gear" size={16} /> {t("settings")}</NavLink>
              <button className="btn btn-sm btn-ghost" onClick={signOut} aria-label={t("signOut")}><Icon name="logout" size={16} /></button>
            </div>
          </div>
        </aside>
        <div className="main">
          <main className="page" id="main" key={loc.pathname}>
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}
