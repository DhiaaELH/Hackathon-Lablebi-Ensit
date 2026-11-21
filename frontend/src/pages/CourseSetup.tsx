import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { qk, useCourse, useInvalidate, useWorkflow } from "../api/hooks";
import type { ResourceT } from "../api/types";
import { AGENT_INITIAL, AGENT_NAME, ErrorBox, Spinner, Tabs } from "../components/ui";
import { useI18n } from "../i18n/I18n";

export function WorkflowProgress({ workflowId, onDone }: { workflowId: string; onDone?: () => void }) {
  const { t } = useI18n();
  const [active, setActive] = useState(true);
  const wf = useWorkflow(workflowId, active);
  const finished = wf.data && ["done", "partial", "failed"].includes(wf.data.status);
  const fired = useRef(false);
  useEffect(() => {
    if (finished && !fired.current) {
      fired.current = true;
      setActive(false);
      onDone?.();
    }
  }, [finished, onDone]);
  if (!wf.data) return <Spinner />;
  return (
    <div className="card stack" aria-live="polite">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2 style={{ margin: 0 }}>{t("workflow")}</h2>
        <span className={`badge ${wf.data.status === "done" ? "badge-success" : wf.data.status === "failed" ? "badge-error" : "badge-primary"}`}>{wf.data.status}</span>
      </div>
      <div className="row">
        {wf.data.tasks.map((task) => (
          <span key={task.id} className={`badge ${task.status === "done" ? "badge-success" : task.status === "failed" || task.status === "needs_review" ? "badge-error" : ""}`}>
            {AGENT_NAME[task.agent_role]} · {task.status}{task.retry_count ? ` (retry ${task.retry_count})` : ""}
          </span>
        ))}
      </div>
      <ol className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {wf.data.events.map((e) => (
          <li key={e.id} className="row small">
            <span className="avatar" aria-hidden="true">{AGENT_INITIAL[e.agent_role] ?? "?"}</span>
            <span><strong>{AGENT_NAME[e.agent_role] ?? e.agent_role}</strong> — {e.message}</span>
          </li>
        ))}
      </ol>
      {!finished && <Spinner label={t("generating")} />}
    </div>
  );
}

export function CourseSetup() {
  const { id = "" } = useParams();
  const { t } = useI18n();
  const course = useCourse(id);
  const invalidate = useInvalidate();
  const nav = useNavigate();
  const [tab, setTab] = useState<"paste" | "upload">("paste");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rights, setRights] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [added, setAdded] = useState<ResourceT[]>([]);
  const [wfId, setWfId] = useState<string | null>(null);

  async function add() {
    setBusy(true);
    setErr(null);
    try {
      let r: ResourceT;
      if (tab === "paste") {
        r = await api.post<ResourceT>(`/api/courses/${id}/resources/text`, { title: "Texte collé", text, rights_confirmed: rights });
        setText("");
      } else {
        if (!file) return;
        const fd = new FormData();
        fd.append("file", file);
        fd.append("rights_confirmed", String(rights));
        r = await api.upload<ResourceT>(`/api/courses/${id}/resources/upload`, fd);
        setFile(null);
      }
      setAdded((a) => [...a, r]);
      await invalidate([...qk.course(id)]);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    setErr(null);
    try {
      const r = await api.post<{ workflow_id: string }>(`/api/courses/${id}/workflow`);
      setWfId(r.workflow_id);
    } catch (e) {
      setErr(e);
    }
  }

  const resources = [...(course.data?.resources ?? [])];
  for (const a of added) if (!resources.some((r) => r.id === a.id)) resources.push(a);

  return (
    <div className="stack" style={{ maxWidth: 820, gap: "1rem" }}>
      <Link to="/" className="small">← {t("myCourses")}</Link>
      <h1>{course.data?.title ?? "…"}</h1>
      <div className="card stack">
        <h2>{t("addMaterial")}</h2>
        <div className="alert alert-warning small">{t("copyright")}</div>
        <Tabs tabs={[{ id: "paste", label: t("pasteText") }, { id: "upload", label: t("uploadFile") }]} value={tab} onChange={setTab} />
        {tab === "paste" ? (
          <div className="field">
            <label htmlFor="paste">{t("pasteText")}</label>
            <textarea id="paste" value={text} onChange={(e) => setText(e.target.value)} placeholder="# Chapitre 1 : …" />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="file">{t("uploadFile")}</label>
            <input id="file" type="file" accept=".pdf,.pptx,.txt,.md,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <span className="small muted">{t("fileRules")}</span>
          </div>
        )}
        <label className="check"><input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} /> {t("rightsConfirm")}</label>
        <div className="row">
          <button className="btn" disabled={busy || !rights || (tab === "paste" ? text.trim().length < 50 : !file)} onClick={add}>{t("addMaterial")}</button>
          {busy && <Spinner />}
        </div>
        {err != null && <ErrorBox error={err} />}
        {resources.length > 0 && (
          <div className="stack small">
            <strong>{t("resources")}</strong>
            {resources.map((r) => (
              <div key={r.id} className="row">
                <span className={`badge ${r.status === "ok" ? "badge-success" : r.status === "failed" ? "badge-error" : "badge-warning"}`}>{r.status}</span>
                <span>{r.filename}</span>
                {r.page_count ? <span className="muted">{r.page_count} p.</span> : null}
                {r.notes?.map((n, i) => <span key={i} className="muted">· {n}</span>)}
              </div>
            ))}
          </div>
        )}
        <p className="small muted" style={{ margin: 0 }}>{t("privateByDefault")}</p>
      </div>
      <div className="row">
        <button className="btn btn-primary" disabled={!resources.some((r) => r.status !== "failed") || !!wfId} onClick={generate}>{t("generate")}</button>
      </div>
      {wfId && <WorkflowProgress workflowId={wfId} onDone={() => { invalidate([...qk.course(id)], [...qk.courses]); setTimeout(() => nav(`/courses/${id}`), 900); }} />}
    </div>
  );
}
