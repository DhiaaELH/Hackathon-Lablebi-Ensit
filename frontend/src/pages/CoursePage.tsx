import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { qk, useCourse, useHealth, useInvalidate, useMe, useProgress } from "../api/hooks";
import { Icon } from "../components/Icon";
import { useToast } from "../components/Toast";
import { ErrorBox, Tabs } from "../components/ui";
import { ClassTab } from "../features/ClassTab";
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

const TABS = ["overview", "practice", "revision", "map", "resources", "exams", "projects", "progress", "class"] as const;
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

const NOVA_PREF = "lf_nova_open";
const isWide = () => typeof window !== "undefined" && window.matchMedia("(min-width: 1101px)").matches;
function readNovaPref(): boolean {
  try { return localStorage.getItem(NOVA_PREF) === "1"; } catch { return false; }
}
function writeNovaPref(open: boolean) {
  try { localStorage.setItem(NOVA_PREF, open ? "1" : "0"); } catch { /* storage unavailable: just not remembered */ }
}

export function CoursePage() {
  const { id = "" } = useParams();
  const { t } = useI18n();
  const [params, setParams] = useSearchParams();
  const course = useCourse(id);
  const progress = useProgress(id);
  const me = useMe();
  const nav = useNavigate();
  const toast = useToast();
  const urlTab = params.get("tab") as Tab | null;
  // Community moved to its own page in the main menu: keep old ?tab=community links working.
  const legacyCommunity = params.get("tab") === "community";
  useEffect(() => {
    if (legacyCommunity) nav(`/community?course=${id}${params.get("chapter") ? `&chapter=${params.get("chapter")}` : ""}`, { replace: true });
  }, [legacyCommunity, id, params, nav]);
  const [tab, setTabState] = useState<Tab>(urlTab && TABS.includes(urlTab) ? urlTab : "overview");
  const [focusSection, setFocusSection] = useState<string | null>(params.get("section"));
  const [novaReq, setNovaReq] = useState<NovaRequest | null>(null);
  // Nova starts retracted (course gets the full width). On wide screens the choice is remembered; on phones it is a drawer
  // that always starts closed so it never covers the course on arrival.
  const [novaOpen, setNovaOpenState] = useState(() => isWide() && readNovaPref());
  const setNovaOpen = useCallback((open: boolean) => {
    setNovaOpenState(open);
    if (isWide()) writeNovaPref(open);
  }, []);
  const [novaFull, setNovaFull] = useState(false);
  // While Nova covers the page (drawer on phones, or full screen anywhere) the page behind must not scroll.
  useEffect(() => {
    if (!novaOpen) { setNovaFull(false); return; }
    if (!novaFull && isWide()) return;
    document.body.classList.add("no-scroll");
    return () => document.body.classList.remove("no-scroll");
  }, [novaOpen, novaFull]);
  const invalidate = useInvalidate();
  const ask = useCallback((r: Omit<NovaRequest, "nonce">) => { setNovaReq({ ...r, nonce: Date.now() }); setNovaOpen(true); }, [setNovaOpen]);
  useEffect(() => {
    if (!novaOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { if (novaFull) setNovaFull(false); else setNovaOpen(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [novaOpen, novaFull, setNovaOpen]);
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
    resources: [t("resourcesTab"), "link"], exams: [t("exams"), "file"], projects: [t("projects"), "compass"], progress: [t("progress"), "pulse"], class: [t("classTab"), "shield"],
  };
  // A course is a classroom for the teachers who own or co-teach it.
  const canTeach = (me.data?.role === "teacher" || me.data?.role === "admin") && (c.access === "owner" || c.access === "teacher");
  const tabs = TABS.filter((x) => x !== "class" || canTeach);
  const shown: Tab = tabs.includes(tab) ? tab : "overview";
  async function removeCourse() {
    const mine = c.access === "owner";
    if (!confirm(t(mine ? "deleteCourseConfirm" : "removeCourseConfirm"))) return;
    try {
      await api.del(mine ? `/api/courses/${c.id}` : `/api/courses/${c.id}/enroll`);
      await invalidate([...qk.courses]);
      toast(t("removedOk"));
      nav("/");
    } catch (e) {
      toast((e as Error).message, "err");
    }
  }
  // on phones the drawer covers the tab Nova points to, so close it; on desktop keep the side panel open
  const openTab = (name: string) => { if ((TABS as readonly string[]).includes(name)) { setTab(name as Tab); setNovaFull(false); if (!isWide()) setNovaOpen(false); } };

  return (
    <div className="course-page">
      <div className="course-head">
        <div className="course-id">
          <div className="ring" style={{ ["--p" as string]: pct }} title={t("progress")}><span>{pct}%</span></div>
          <div className="stack" style={{ gap: 4, minWidth: 0 }}>
            <Link to="/" className="small back-link"><Icon name="back" size={13} /> {t("myCourses")}</Link>
            <h1 className="course-title">{c.title.replace("[DÉMO] ", "")}</h1>
            <div className="row small">
              <span className={`badge ${c.visibility === "published" ? "badge-primary" : ""}`}>{c.visibility === "published" ? t("published") : t("private")}</span>
              {c.is_demo && <span className="badge badge-warning">{t("demo")}</span>}
              {c.workflow?.demo_mode && <span className="badge badge-warning">demo fixtures</span>}
            </div>
          </div>
        </div>
        <div className="row course-actions">
          {c.access === "owner" && <Link className="btn btn-sm" to={`/courses/${c.id}/setup`}><Icon name="plus" size={14} /> {t("addMaterial")}</Link>}
          {(c.access === "owner" || c.access === "teacher") && !processing && <RegenerateButton courseId={c.id} />}
          {c.access === "owner" && <PublishControl courseId={c.id} visibility={c.visibility} />}
          {(c.access === "member" || c.access === "teacher") && <button className="btn btn-sm" onClick={removeCourse}><Icon name="x" size={14} /> {t("removeCourse")}</button>}
          {c.access === "owner" && <button className="btn btn-sm btn-danger btn-icon" onClick={removeCourse} aria-label={t("deleteCourse")} title={t("deleteCourse")}><Icon name="trash" size={15} /></button>}
        </div>
      </div>
      {c.workflow && (processing || (c.workflow.status === "partial" && (c.access === "owner" || c.access === "teacher"))) && (
        <WorkflowProgress workflowId={c.workflow.id} onDone={onWorkflowDone} canRetry={c.access === "owner" || c.access === "teacher"} />
      )}
      <Tabs tabs={tabs.map((x) => ({ id: x, label: labels[x][0], icon: labels[x][1] }))} value={shown} onChange={setTab} />
      <div className={`workspace${novaOpen ? " nova-is-open" : " nova-is-closed"}`}>
        <div className="workspace-main">
          {shown === "overview" && <Overview course={c} focusSection={focusSection} />}
          {shown === "practice" && <Practice course={c} ask={ask} />}
          {shown === "revision" && <RevisionTab course={c} />}
          {shown === "map" && <TopicMap course={c} onOpenSection={openSection} />}
          {shown === "resources" && <ResourcesTab course={c} />}
          {shown === "exams" && <ExamsTab course={c} />}
          {shown === "projects" && <ProjectsTab course={c} />}
          {shown === "progress" && <ProgressTab course={c} />}
          {shown === "class" && <ClassTab course={c} />}
        </div>
        <div className={`nova-dock${novaOpen ? " open" : ""}${novaOpen && novaFull ? " full" : ""}`}>
          <NovaPanel courseId={c.id} refs={c.refs} request={novaReq} onOpenTab={openTab} onClose={() => setNovaOpen(false)}
            full={novaFull} onToggleFull={() => setNovaFull((f) => !f)} />
        </div>
      </div>
      <div className={`nova-scrim${novaOpen ? " open" : ""}`} onClick={() => setNovaOpen(false)} aria-hidden="true" />
      {!novaOpen && (
        <button type="button" className="nova-fab" onClick={() => setNovaOpen(true)} aria-label={t("askNova")}>
          <span className="nova-orb" aria-hidden="true" /> {t("askNova")}
        </button>
      )}
    </div>
  );
}
