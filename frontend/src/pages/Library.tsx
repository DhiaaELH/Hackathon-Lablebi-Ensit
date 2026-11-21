import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { qk, useInvalidate, useLibrary } from "../api/hooks";
import { Empty, ErrorBox, Spinner } from "../components/ui";
import { useI18n } from "../i18n/I18n";
import { CourseTile } from "./Dashboard";

export function Library() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const lib = useLibrary(query);
  const invalidate = useInvalidate();
  const nav = useNavigate();
  async function join(id: string) {
    await api.post(`/api/courses/${id}/enroll`);
    await invalidate([...qk.courses]);
    nav(`/courses/${id}`);
  }
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <h1>{t("library")}</h1>
      <form className="row" onSubmit={(e) => { e.preventDefault(); setQuery(q); }} role="search" style={{ flexWrap: "nowrap", maxWidth: 560 }}>
        <label htmlFor="lq" className="sr-only">{t("search")}</label>
        <input id="lq" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} />
        <button className="btn" type="submit">{t("search")}</button>
      </form>
      {lib.isLoading && <Spinner />}
      {lib.error && <ErrorBox error={lib.error} />}
      {lib.data?.length === 0 && <Empty>{t("libraryEmpty")}</Empty>}
      <div className="grid grid-2">
        {lib.data?.map((c) => (
          <CourseTile key={c.id} c={c} action={c.access === "public"
            ? <button className="btn btn-primary btn-sm" onClick={() => join(c.id)}>{t("enroll")}</button>
            : <Link className="btn btn-primary btn-sm" to={`/courses/${c.id}`}>{t("open")}</Link>} />
        ))}
      </div>
    </div>
  );
}
