import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { qk, useCourse, useInvalidate, useWorkflow } from "../api/hooks";
import type { ResourceT } from "../api/types";
import { Icon } from "../components/Icon";
import { AgentAvatar, ErrorBox, Spinner, Tabs, useAgentLabel } from "../components/ui";
import { useI18n } from "../i18n/I18n";

export function WorkflowProgress({ workflowId, onDone, canRetry = true }: { workflowId: string; onDone?: () => void; canRetry?: boolean }) {
  const { t } = useI18n();
  const [active, setActive] = useState(true);
  const wf = useWorkflow(workflowId, active);
  const agentLabel = useAgentLabel();
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
            {agentLabel(task.agent_role)} · {task.status}{task.retry_count ? ` (retry ${task.retry_count})` : ""}
          </span>
        ))}
      </div>
      <ol className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {wf.data.events.map((e) => (
          <li key={e.id} className="row small">
            <AgentAvatar role={e.agent_role} />
            <span><strong>{agentLabel(e.agent_role)}</strong> — {e.message}</span>
          </li>
        ))}
      </ol>
      {!finished && <Spinner label={t("generating")} />}
      {canRetry && finished && wf.data.status !== "done" && wf.data.tasks.some((x) => ["failed", "needs_review"].includes(x.status) && x.agent_role !== "clara") && (
        <div className="row">
          <button className="btn btn-accent btn-sm" onClick={async () => {
            await api.post(`/api/workflows/${workflowId}/retry`);
            fired.current = false;
            setActive(true);
          }}><Icon name="wand" size={14} /> {t("retryFailed")}</button>
          <span className="tiny muted">{wf.data.tasks.filter((x) => x.status === "failed").map((x) => agentLabel(x.agent_role)).join(", ")}</span>
        </div>
      )}
    </div>
  );
}

export function CourseSetup() {
  const { id = "" } = useParams();
  const { t } = useI18n();
  const course = useCourse(id);
  const invalidate = useInvalidate();
  const nav = useNavigate();
  const [tab, setTab] = useState<"paste" | "upload" | "youtube">("paste");
  const [yt, setYt] = useState("");
  const [drag, setDrag] = useState(false);
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
      } else if (tab === "youtube") {
        r = await api.post<ResourceT>(`/api/courses/${id}/resources/youtube`, { url: yt, rights_confirmed: rights }, 120_000);
        setYt("");
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

  const [removed, setRemoved] = useState<string[]>([]);
  async function removeResource(rid: string) {
    if (!confirm(t("confirmDelete"))) return;
    try {
      await api.del(`/api/courses/${id}/resources/${rid}`);
      setRemoved((x) => [...x, rid]);
      await invalidate([...qk.course(id)]);
    } catch (e) {
      setErr(e);
    }
  }

  const resources = [...(course.data?.resources ?? [])];
  for (const a of added) if (!resources.some((r) => r.id === a.id)) resources.push(a);
  for (const rid of removed) { const i = resources.findIndex((r) => r.id === rid); if (i >= 0) resources.splice(i, 1); }

  return (
    <div className="stack" style={{ maxWidth: 820, gap: "1rem" }}>
      <Link to="/" className="small"><Icon name="back" size={13} /> {t("myCourses")}</Link>
      <h1>{course.data?.title ?? "…"}</h1>
      <div className="card stack">
        <h2>{t("addMaterial")}</h2>
        <div className="alert alert-warning small">{t("copyright")}</div>
        <Tabs tabs={[{ id: "paste", label: t("pasteText"), icon: "file" }, { id: "upload", label: t("uploadFile"), icon: "download" }, { id: "youtube", label: t("youtube"), icon: "video" }]} value={tab} onChange={setTab} />
        {tab === "paste" && (
          <div className="field">
            <label htmlFor="paste">{t("pasteText")}</label>
            <textarea id="paste" value={text} onChange={(e) => setText(e.target.value)} placeholder={"# Chapitre 1 : …\n## 1.1 …\nTerme : définition\nFormule : $a^2 + b^2 = c^2$"} style={{ minHeight: 220, fontFamily: "var(--mono)", fontSize: "0.94rem" }} />
            <span className="tiny muted">{text.length.toLocaleString()} caractères</span>
          </div>
        )}
        {tab === "upload" && (
          <label htmlFor="file" className="stack" style={{ alignItems: "center", textAlign: "center", padding: "2rem 1rem", border: `1.5px dashed ${drag ? "var(--primary)" : "var(--line-strong)"}`,
            borderRadius: 12, background: drag ? "var(--primary-soft)" : "var(--paper)", cursor: "pointer", transition: "all .15s" }}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); setFile(e.dataTransfer.files?.[0] ?? null); }}>
            <Icon name="download" size={28} />
            <strong>{file ? file.name : t("uploadFile")}</strong>
            <span className="small muted">{t("fileRules")}</span>
            <input id="file" type="file" className="sr-only" accept=".pdf,.pptx,.txt,.md,.png,.jpg,.jpeg" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        )}
        {tab === "youtube" && (
          <div className="field">
            <label htmlFor="yt">{t("youtube")}</label>
            <input id="yt" type="url" value={yt} onChange={(e) => setYt(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
            <span className="tiny muted">Gemini lit la vidéo et en extrait le contenu avec des horodatages. Échoue proprement si la vidéo n'est pas accessible.</span>
          </div>
        )}
        <label className="check"><input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} /> {t("rightsConfirm")}</label>
        <div className="row">
          <button className="btn btn-primary" disabled={busy || !rights || (tab === "paste" ? text.trim().length < 50 : tab === "youtube" ? yt.length < 15 : !file)} onClick={add}><Icon name="plus" size={14} /> {t("addMaterial")}</button>
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
                <button type="button" className="btn btn-sm btn-ghost btn-icon" style={{ marginInlineStart: "auto" }} onClick={() => removeResource(r.id)}
                  aria-label={`${t("deleteIt")} ${r.filename}`} title={t("deleteIt")}><Icon name="trash" size={15} /></button>
              </div>
            ))}
          </div>
        )}
        <p className="small muted" style={{ margin: 0 }}>{t("privateByDefault")}</p>
      </div>
      <div className="row">
        <button className="btn btn-accent" disabled={!resources.some((r) => r.status !== "failed") || !!wfId} onClick={generate}><Icon name="wand" size={15} /> {t("generate")}</button>
      </div>
      {wfId && <WorkflowProgress workflowId={wfId} onDone={() => { invalidate([...qk.course(id)], [...qk.courses]); setTimeout(() => nav(`/courses/${id}`), 900); }} />}
    </div>
  );
}
