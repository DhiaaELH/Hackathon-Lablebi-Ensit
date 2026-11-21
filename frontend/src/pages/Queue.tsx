import { Link } from "react-router-dom";
import { useMe, useQueue } from "../api/hooks";
import { Icon } from "../components/Icon";
import { Empty, Spinner } from "../components/ui";
import { useI18n } from "../i18n/I18n";
import type { MessageKey } from "../i18n/messages";

export function Queue() {
  const { t } = useI18n();
  const me = useMe();
  const q = useQueue(!!me.data);
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <header className="page-head"><div><h1>{t("seniorQueue")}</h1><p>{t("queueIntro")}</p></div></header>
      {q.isLoading && <Spinner />}
      {q.data?.items.length === 0 && <Empty>{t("nothingHere")}</Empty>}
      <div className="grid grid-2">
        {q.data?.items.map((i) => (
          <div key={i.section_id} className="card card-hover stack">
            <span className="eyebrow">{i.course.replace("[DÉMO] ", "")} · {i.chapter}</span>
            <h3 style={{ margin: 0 }}>{i.section}</h3>
            <div className="row small">
              <span className="badge badge-warning"><Icon name="users" size={12} /> {i.students} {t("students")}</span>
              {i.top_reason && <span className="badge">{t(`reason_${i.top_reason}` as MessageKey)}</span>}
            </div>
            <div className="row">
              <Link className="btn btn-sm btn-primary" to={`/courses/${i.course_id}?section=${i.section_id}`}>{t("open")}</Link>
              <Link className="btn btn-sm" to={`/courses/${i.course_id}?tab=community&chapter=${i.chapter_id}`}>{t("answerInCommunity")}</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
