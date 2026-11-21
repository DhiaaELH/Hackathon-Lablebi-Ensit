import { api } from "../api/client";
import { qk, useInvalidate, useReports } from "../api/hooks";
import { useToast } from "../components/Toast";
import { Empty, Spinner } from "../components/ui";
import { useI18n } from "../i18n/I18n";

export function Moderation() {
  const { t } = useI18n();
  const reports = useReports();
  const invalidate = useInvalidate();
  const toast = useToast();
  async function resolve(id: string, action: "dismiss" | "remove") {
    try {
      await api.post(`/api/admin/reports/${id}`, { action });
      invalidate([...qk.reports]);
      toast(action === "remove" ? t("remove") : t("dismissReport"));
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <header className="page-head"><h1>{t("moderation")}</h1></header>
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
    </div>
  );
}
