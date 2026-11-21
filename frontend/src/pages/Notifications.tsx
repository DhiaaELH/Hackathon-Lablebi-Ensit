import { Link } from "react-router-dom";
import { api } from "../api/client";
import { qk, useInvalidate, useNotifications } from "../api/hooks";
import { Empty, Spinner } from "../components/ui";
import { useI18n } from "../i18n/I18n";

export function Notifications() {
  const { t } = useI18n();
  const n = useNotifications(true);
  const invalidate = useInvalidate();
  if (n.isLoading) return <Spinner />;
  return (
    <div className="stack" style={{ maxWidth: 760 }}>
      <h1>{t("notifications")}</h1>
      {n.data?.length === 0 && <Empty>{t("noNotifications")}</Empty>}
      {n.data?.map((x) => (
        <div key={x.id} className="card stack" style={x.read ? { opacity: 0.7 } : undefined}>
          <strong>{x.title}</strong>
          <span>{x.body}</span>
          <div className="row small">
            <span className="muted">{new Date(x.at).toLocaleString()}</span>
            {x.link && <Link to={x.link}>{t("open")}</Link>}
            {!x.read && <button className="btn btn-sm" onClick={async () => { await api.post(`/api/notifications/${x.id}/read`); invalidate([...qk.notifications]); }}>✓</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
