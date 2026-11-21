import { useState } from "react";
import { api } from "../api/client";
import { qk, useAdminStats, useAdminUsers, useInvalidate, useMe, useReports } from "../api/hooks";
import type { AdminUser, Role } from "../api/types";
import { Icon } from "../components/Icon";
import { useToast } from "../components/Toast";
import { Empty, ErrorBox, Spinner, Tabs } from "../components/ui";
import { useI18n } from "../i18n/I18n";
import type { MessageKey } from "../i18n/messages";

const ROLES: Role[] = ["student", "senior", "teacher", "admin"];

function Reports() {
  const { t } = useI18n();
  const reports = useReports();
  const invalidate = useInvalidate();
  const toast = useToast();
  async function resolve(id: string, action: "dismiss" | "remove") {
    try {
      await api.post(`/api/admin/reports/${id}`, { action });
      invalidate([...qk.reports], [...qk.adminStats]);
      toast(action === "remove" ? t("remove") : t("dismissReport"));
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }
  return (
    <>
      {reports.isLoading && <Spinner />}
      {reports.data?.length === 0 && <Empty>{t("nothingHere")}</Empty>}
      {reports.data?.map((r) => (
        <div key={r.id} className="card stack">
          <div className="row between">
            <span className="row"><span className="badge">{r.target_type}</span><span className="tiny muted">{new Date(r.at).toLocaleString()}</span></span>
            <div className="row">
              <button className="btn btn-sm" onClick={() => resolve(r.id, "dismiss")}>{t("dismissReport")}</button>
              {r.target_type !== "user" && <button className="btn btn-sm btn-danger" onClick={() => resolve(r.id, "remove")}>{t("remove")}</button>}
            </div>
          </div>
          <div className="small"><strong>{t("report")}:</strong> {r.reason}</div>
          {r.preview && <blockquote className="small muted" style={{ margin: 0, paddingInlineStart: 10, borderInlineStart: "3px solid var(--line-strong)" }}>{r.preview}</blockquote>}
        </div>
      ))}
    </>
  );
}

/** Accounts: search, change a role (this is how a student becomes a peer tutor), delete an account. */
function Users() {
  const { t, tf } = useI18n();
  const me = useMe();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const users = useAdminUsers(query, role);
  const invalidate = useInvalidate();
  const toast = useToast();
  const refresh = () => invalidate(["adminUsers"], [...qk.adminStats]);
  async function setUserRole(u: AdminUser, r: Role) {
    try {
      await api.patch(`/api/admin/users/${encodeURIComponent(u.username)}`, { role: r });
      toast(t("toastSaved"));
    } catch (e) {
      toast((e as Error).message, "err");
    }
    refresh();
  }
  async function remove(u: AdminUser) {
    if (!confirm(tf("deleteUserConfirm", { name: u.display_name }))) return;
    try {
      await api.del(`/api/admin/users/${encodeURIComponent(u.username)}`);
      toast(t("removedOk"));
    } catch (e) {
      toast((e as Error).message, "err");
    }
    refresh();
  }
  return (
    <div className="card stack">
      <form className="row" role="search" onSubmit={(e) => { e.preventDefault(); setQuery(q); }}>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")} style={{ flex: 1, minWidth: 180 }} />
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label={t("changeRole")} style={{ width: "auto" }}>
          <option value="">{t("allRoles")}</option>
          {ROLES.map((r) => <option key={r} value={r}>{t(`role_${r}` as MessageKey)}</option>)}
        </select>
        <button className="btn" type="submit"><Icon name="search" size={14} /> {t("search")}</button>
      </form>
      {users.isLoading && <Spinner />}
      {users.error && <ErrorBox error={users.error} />}
      {users.data?.length === 0 && <Empty>{t("nothingHere")}</Empty>}
      <div>
        {users.data?.map((u) => (
          <div key={u.username} className="roster-row" style={{ flexWrap: "wrap" }}>
            <div className="grow">
              <strong>{u.display_name}</strong> {u.is_demo && <span className="badge badge-warning">{t("demo")}</span>}
              <div className="tiny muted" style={{ overflowWrap: "anywhere" }}>@{u.username} · {u.email} · {u.courses} {t("statCourses").toLowerCase()}</div>
            </div>
            <select value={u.role} onChange={(e) => setUserRole(u, e.target.value as Role)} aria-label={`${t("changeRole")} — ${u.display_name}`} style={{ width: "auto", padding: "0.3rem 0.5rem" }}
              disabled={u.username === me.data?.username}>
              {ROLES.map((r) => <option key={r} value={r}>{t(`role_${r}` as MessageKey)}</option>)}
            </select>
            <button className="btn btn-sm btn-danger btn-icon" disabled={u.username === me.data?.username} onClick={() => remove(u)}
              aria-label={`${t("deleteIt")} — ${u.display_name}`} title={t("deleteIt")}><Icon name="trash" size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Moderation() {
  const { t } = useI18n();
  const stats = useAdminStats();
  const [view, setView] = useState<"reports" | "users">("reports");
  const s = stats.data;
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <header className="page-head"><h1>{t("moderation")}</h1></header>
      {s && (
        <div className="stat-grid">
          <div className="stat"><strong>{Object.values(s.users).reduce((a, b) => a + b, 0)}</strong><span className="small muted">{t("statUsers")}</span>
            <div className="tiny muted">{ROLES.map((r) => `${s.users[r]} ${t(`role_${r}` as MessageKey).toLowerCase()}`).join(" · ")}</div></div>
          <div className="stat"><strong>{s.courses}</strong><span className="small muted">{t("statCourses")}</span><div className="tiny muted">{s.published} {t("statPublished").toLowerCase()}</div></div>
          <div className="stat"><strong>{s.attempts}</strong><span className="small muted">{t("statAttempts")}</span></div>
          <div className="stat"><strong>{s.open_reports}</strong><span className="small muted">{t("statReports")}</span></div>
        </div>
      )}
      <Tabs value={view} onChange={setView} tabs={[{ id: "reports", label: t("reportsAdmin"), icon: "flag" }, { id: "users", label: t("usersAdmin"), icon: "users" }]} />
      {view === "reports" ? <Reports /> : <Users />}
    </div>
  );
}
