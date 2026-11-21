import { useCallback, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { qk, useCourse, useHealth, useInvalidate } from "../api/hooks";
import { ErrorBox, Spinner, Tabs } from "../components/ui";
import { Community } from "../features/Community";
import { NovaPanel, type NovaRequest } from "../features/Nova";
import { Overview } from "../features/Overview";
import { Practice } from "../features/Practice";
import { ProgressTab } from "../features/ProgressTab";
import { ProjectsTab } from "../features/ProjectsTab";
import { RevisionTab } from "../features/Revision";
import { TopicMap } from "../features/TopicMap";
import { useI18n } from "../i18n/I18n";
import { WorkflowProgress } from "./CourseSetup";

type Tab = "overview" | "practice" | "revision" | "map" | "projects" | "progress" | "community";

function PublishControl({ courseId, visibility }: { courseId: string; visibility: string }) {
  const { t } = useI18n();
  const [preview, setPreview] = useState<{ visible: string[]; never_visible: string[] } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const invalidate = useInvalidate();
  async function set(v: "private" | "published") {
    await api.patch(`/api/courses/${courseId}/visibility`, { visibility: v, confirm: v === "published" && confirm });
    setPreview(null);
    invalidate([...qk.course(courseId)], [...qk.courses]);
  }
  if (visibility === "published") return <button className="btn btn-sm" onClick={() => set("private")}>{t("unpublish")}</button>;
  return (
    <div className="stack">
      <button className="btn btn-sm" onClick={async () => setPreview(await api.get(`/api/courses/${courseId}/publish-preview`))}>{t("publish")}</button>
      {preview && (
        <div className="card stack small" role="dialog" aria-label={t("publish")}>
          <strong>{t("publishConfirm")}</strong>
          <ul className="term-list">{preview.visible.map((v) => <li key={v}>{v}</li>)}</ul>
          <strong>{t("neverVisible")}</strong>
          <ul className="term-list">{preview.never_visible.map((v) => <li key={v}>{v}</li>)}</ul>
          <label className="check"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /> {t("confirmPublish")}</label>
          <div className="row">
            <button className="btn btn-primary btn-sm" disabled={!confirm} onClick={() => set("published")}>{t("publish")}</button>
            <button className="btn btn-sm" onClick={() => setPreview(null)}>{t("cancel")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function RegenerateButton({ courseId }: { courseId: string }) {
  const { t } = useI18n();
  const health = useHealth();
  const invalidate = useInvalidate();
  const [err, setErr] = useState<unknown>(null);
  if (!health.data || health.data.demo_mode) return null;
  async function run() {
    if (!confirm(t("regenerateConfirm"))) return;
    try {
      await api.post(`/api/courses/${courseId}/workflow`);
      await invalidate([...qk.course(courseId)], [...qk.assessments(courseId)], [...qk.revision(courseId)]);
    } catch (e) {
      setErr(e);
    }
  }
  return (
    <>
      <button className="btn btn-sm btn-primary" onClick={run} title={`${health.data.provider} · ${health.data.model}`}>✨ {t("regenerate")}</button>
      {err != null && <ErrorBox error={err} />}
    </>
  );
}

export function CoursePage() {
  const { id = "" } = useParams();
  const { t } = useI18n();
  const course = useCourse(id);
  const [tab, setTab] = useState<Tab>("overview");
  const [novaReq, setNovaReq] = useState<NovaRequest | null>(null);
  const invalidate = useInvalidate();
  const ask = useCallback((r: Omit<NovaRequest, "nonce">) => setNovaReq({ ...r, nonce: Date.now() }), []);
  const onWorkflowDone = useCallback(
    () => invalidate([...qk.course(id)], [...qk.assessments(id)], [...qk.revision(id)], [...qk.progress(id)]),
    [id, invalidate],
  );

  if (course.isLoading) return <Spinner />;
  if (course.error || !course.data) return <ErrorBox error={course.error} />;
  const c = course.data;
  const processing = c.workflow && ["queued", "running"].includes(c.workflow.status);
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: t("overview") }, { id: "practice", label: t("practice") }, { id: "revision", label: t("revision") },
    { id: "map", label: t("map") }, { id: "projects", label: t("projects") }, { id: "progress", label: t("progress") }, { id: "community", label: t("community") },
  ];
  const openTab = (name: string) => {
    const found = tabs.find((x) => x.id === name);
    if (found) setTab(found.id);
  };

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="stack" style={{ gap: 4 }}>
          <Link to="/" className="small">← {t("myCourses")}</Link>
          <h1 style={{ margin: 0 }}>{c.title}</h1>
          <div className="row small">
            <span className={`badge ${c.visibility === "published" ? "badge-primary" : ""}`}>{c.visibility === "published" ? t("published") : t("private")}</span>
            {c.is_demo && <span className="badge badge-warning">{t("demo")}</span>}
            {c.workflow?.demo_mode && <span className="badge badge-warning">demo fixtures</span>}
          </div>
        </div>
        <div className="row">
          {c.access === "owner" && <Link className="btn btn-sm" to={`/courses/${c.id}/setup`}>+ {t("addMaterial")}</Link>}
          {(c.access === "owner" || c.access === "teacher") && !processing && <RegenerateButton courseId={c.id} />}
          {c.access === "owner" && <PublishControl courseId={c.id} visibility={c.visibility} />}
        </div>
      </div>
      {processing && c.workflow && <WorkflowProgress workflowId={c.workflow.id} onDone={onWorkflowDone} />}
      <div className="workspace">
        <div>
          <Tabs tabs={tabs} value={tab} onChange={setTab} />
          {tab === "overview" && <Overview course={c} />}
          {tab === "practice" && <Practice course={c} ask={ask} />}
          {tab === "revision" && <RevisionTab course={c} />}
          {tab === "map" && <TopicMap course={c} />}
          {tab === "projects" && <ProjectsTab course={c} />}
          {tab === "progress" && <ProgressTab course={c} />}
          {tab === "community" && <Community course={c} />}
        </div>
        <NovaPanel courseId={c.id} refs={c.refs} request={novaReq} onOpenTab={openTab} />
      </div>
    </div>
  );
}
