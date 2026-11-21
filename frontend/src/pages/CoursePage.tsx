import { useCallback, useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { qk, useCourse, useHealth, useInvalidate, useProgress } from "../api/hooks";
import { Icon } from "../components/Icon";
import { useToast } from "../components/Toast";
import { ErrorBox, Tabs } from "../components/ui";
import { Community } from "../features/Community";
import { ExamsTab } from "../features/Exams";
import { NovaPanel, type NovaRequest } from "../features/Nova";
import { Overview } from "../features/Overview";
import { Practice } from "../features/Practice";
import { ProgressTab } from "../features/ProgressTab";
import { ProjectsTab } from "../features/ProjectsTab";
import { ResourcesTab } from "../features/Resources";
import { RevisionTab } from "../features/Revision";
import { TopicMap } from "../features/TopicMap";
import { useI18n } from "../i18n/I18n";
import { WorkflowProgress } from "./CourseSetup";

const TABS = ["overview", "practice", "revision", "map", "resources", "exams", "projects", "progress", "community"] as const;
type Tab = (typeof TABS)[number];

function PublishControl({ courseId, visibility }: { courseId: string; visibility: string }) {
  const { t } = useI18n();
  const [preview, setPreview] = useState<{ visible: string[]; never_visible: string[] } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const invalidate = useInvalidate();
  const toast = useToast();
  async function set(v: "private" | "published") {
    await api.patch(`/api/courses/${courseId}/visibility`, { visibility: v, confirm: v === "published" && confirm });
    setPreview(null);
    invalidate([...qk.course(courseId)], [...qk.courses]);
    toast(v === "published" ? t("published") : t("private"));
  }
  if (visibility === "published") return <button className="btn btn-sm" onClick={() => set("private")}><Icon name="lock" size={14} /> {t("unpublish")}</button>;
  return (
    <div style={{ position: "relative" }}>
      <button className="btn btn-sm" onClick={async () => setPreview(await api.get(`/api/courses/${courseId}/publish-preview`))}><Icon name="library" size={14} /> {t("publish")}</button>
      {preview && (
        <div className="card stack small" role="dialog" aria-label={t("publish")} style={{ position: "absolute", insetInlineEnd: 0, top: "110%", width: 340, zIndex: 20, boxShadow: "var(--shadow-lift)" }}>
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
  const toast = useToast();
  if (!health.data || health.data.demo_mode) return null;
  async function run() {
    if (!confirm(t("regenerateConfirm"))) return;
    try {
      await api.post(`/api/courses/${courseId}/workflow`);
      await invalidate([...qk.course(courseId)], [...qk.assessments(courseId)], [...qk.revision(courseId)]);
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }
  return <button className="btn btn-sm" onClick={run} title={health.data.tiers?.smart}><Icon name="wand" size={14} /> {t("regenerate")}</button>;
}

export function CoursePage() {
  const { id = "" } = useParams();
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const course = useCourse(id);
  const progress = useProgress(id);
  const urlTab = params.get("tab") as Tab | null;
  const [tab, setTabState] = useState<Tab>(urlTab && TABS.includes(urlTab) ? urlTab : "overview");
  const [focusSection, setFocusSection] = useState<string | null>(params.get("section"));
  const [novaReq, setNovaReq] = useState<NovaRequest | null>(null);
  const invalidate = useInvalidate();
  const ask = useCallback((r: Omit<NovaRequest, "nonce">) => setNovaReq({ ...r, nonce: Date.now() }), []);
  const onWorkflowDone = useCallback(
    () => invalidate([...qk.course(id)], [...qk.assessments(id)], [...qk.revision(id)], [...qk.progress(id)]),
    [id, invalidate],
  );
  const setTab = (v: Tab) => {
    setTabState(v);
    const p = new URLSearchParams(params);
    p.set("tab", v);
    p.delete("section");
    setParams(p, { replace: true });
  };
  useEffect(() => {
    const s = params.get("section");
    if (s) { setTabState("overview"); setFocusSection(s); }
  }, [params]);
  const openSection = (sid: string) => { setTabState("overview"); setFocusSection(null); setTimeout(() => setFocusSection(sid), 30); };

  if (course.isLoading) return <div className="stack"><div className="skeleton" style={{ height: 34, width: "50%" }} /><div className="skeleton" style={{ height: 300 }} /></div>;
  if (course.error || !course.data) return <ErrorBox error={course.error} />;
  const c = course.data;
  const processing = c.workflow && ["queued", "running"].includes(c.workflow.status);
  const pct = progress.data?.sections_total ? Math.round((progress.data.sections_done / progress.data.sections_total) * 100) : 0;
  const labels: Record<Tab, [string, string]> = {
    overview: [t("overview"), "book"], practice: [t("practice"), "wand"], revision: [t("revision"), "layers"], map: [t("map"), "map"],
    resources: [t("resourcesTab"), "link"], exams: [t("exams"), "file"], projects: [t("projects"), "compass"], progress: [t("progress"), "pulse"], community: [t("community"), "users"],
  };
  const openTab = (name: string) => { if ((TABS as readonly string[]).includes(name)) setTab(name as Tab); };

  return (
    <div className="stack">
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
          <div className="ring" style={{ ["--p" as string]: pct }} title={t("progress")}><span>{pct}%</span></div>
          <div className="stack" style={{ gap: 4 }}>
            <Link to="/" className="small"><Icon name="back" size={13} /> {t("myCourses")}</Link>
            <h1 style={{ margin: 0 }}>{c.title.replace("[DÉMO] ", "")}</h1>
            <div className="row small">
              <span className={`badge ${c.visibility === "published" ? "badge-primary" : ""}`}>{c.visibility === "published" ? t("published") : t("private")}</span>
              {c.is_demo && <span className="badge badge-warning">{t("demo")}</span>}
              {c.workflow?.demo_mode && <span className="badge badge-warning">demo fixtures</span>}
            </div>
          </div>
        </div>
        <div className="row">
          {c.access === "owner" && <Link className="btn btn-sm" to={`/courses/${c.id}/setup`}><Icon name="plus" size={14} /> {t("addMaterial")}</Link>}
          {(c.access === "owner" || c.access === "teacher") && !processing && <RegenerateButton courseId={c.id} />}
          {c.access === "owner" && <PublishControl courseId={c.id} visibility={c.visibility} />}
        </div>
      </div>
      {c.workflow && (processing || (c.workflow.status === "partial" && (c.access === "owner" || c.access === "teacher"))) && (
        <WorkflowProgress workflowId={c.workflow.id} onDone={onWorkflowDone} canRetry={c.access === "owner" || c.access === "teacher"} />
      )}
      <div className="workspace">
        <div style={{ minWidth: 0 }}>
          <Tabs tabs={TABS.map((x) => ({ id: x, label: labels[x][0], icon: labels[x][1] }))} value={tab} onChange={setTab} />
          {tab === "overview" && <Overview course={c} focusSection={focusSection} />}
          {tab === "practice" && <Practice course={c} ask={ask} />}
          {tab === "revision" && <RevisionTab course={c} />}
          {tab === "map" && <TopicMap course={c} onOpenSection={openSection} />}
          {tab === "resources" && <ResourcesTab course={c} />}
          {tab === "exams" && <ExamsTab course={c} />}
          {tab === "projects" && <ProjectsTab course={c} />}
          {tab === "progress" && <ProgressTab course={c} />}
          {tab === "community" && <Community course={c} initialChapter={params.get("chapter")} />}
        </div>
        <NovaPanel courseId={c.id} refs={c.refs} request={novaReq} onOpenTab={openTab} />
      </div>
    </div>
  );
}
