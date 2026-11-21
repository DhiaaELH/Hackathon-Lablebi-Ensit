import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useHealth, useMe, useNotifications, useQueryClient } from "../api/hooks";
import type { Lang } from "../api/types";
import { useI18n } from "../i18n/I18n";
import { LANG_LABEL } from "../i18n/messages";

export function LanguageSwitch() {
  const { lang, setLang, t } = useI18n();
  return (
    <label className="row small">
      <span className="sr-only">{t("language")}</span>
      <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label={t("language")} style={{ width: "auto" }}>
        {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
          <option key={l} value={l}>{LANG_LABEL[l]}</option>
        ))}
      </select>
    </label>
  );
}

export function Layout() {
  const { t } = useI18n();
  const me = useMe();
  const health = useHealth();
  const notes = useNotifications(!!me.data);
  const qc = useQueryClient();
  const nav = useNavigate();
  const unread = notes.data?.filter((n) => !n.read).length ?? 0;
  const isTeacher = me.data && (me.data.role === "teacher" || me.data.role === "admin");

  async function signOut() {
    await api.post("/api/auth/logout");
    qc.clear();
    nav("/login");
  }

  return (
    <>
      {health.data?.demo_mode && <div className="demo-banner" role="note">{t("demoMode")}</div>}
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand" aria-label="LessonForge">
            <span className="brand-mark" aria-hidden="true">L</span>
            <span>LessonForge<small>{t("appTagline")}</small></span>
          </NavLink>
          <nav className="nav" aria-label="Main">
            <NavLink to="/" end>{t("learn")}</NavLink>
            <NavLink to="/library">{t("library")}</NavLink>
            {isTeacher && <NavLink to="/insights">{t("insights")}</NavLink>}
            <NavLink to="/notifications">{t("notifications")}{unread ? ` (${unread})` : ""}</NavLink>
            <NavLink to="/settings">{t("settings")}</NavLink>
          </nav>
          <span className="spacer" />
          <LanguageSwitch />
          {me.data && (
            <span className="row small">
              <span className="muted">{me.data.display_name}</span>
              <span className="badge">{me.data.role}</span>
              <button className="btn btn-sm" onClick={signOut}>{t("signOut")}</button>
            </span>
          )}
        </div>
      </header>
      <main className="page" id="main">
        <Outlet />
      </main>
    </>
  );
}
