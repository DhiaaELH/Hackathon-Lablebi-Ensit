import { useState } from "react";
import { api } from "../api/client";
import { qk, useInvalidate, useProjects } from "../api/hooks";
import type { CourseDetail } from "../api/types";
import { ErrorBox, ProgressBar, Spinner } from "../components/ui";
import { useI18n } from "../i18n/I18n";

export function ProjectsTab({ course }: { course: CourseDetail }) {
  const { t } = useI18n();
  const p = useProjects(course.id);
  const invalidate = useInvalidate();
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  if (p.isLoading) return <Spinner />;
  if (p.error) return <ErrorBox error={p.error} />;

  async function generate(chapterId: string) {
    setBusy(chapterId);
    try {
      await api.post(`/api/chapters/${chapterId}/projects/generate`);
      await invalidate([...qk.projects(course.id)]);
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(null);
    }
  }
  async function status(id: string, s: string, progress = 0) {
    await api.put(`/api/projects/${id}/status`, { status: s, progress });
    invalidate([...qk.projects(course.id)]);
  }

  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="alert small"><strong>{t("completionCriteria")}:</strong> {p.data?.criteria}</div>
      {err != null && <ErrorBox error={err} />}
      {p.data?.chapters.map((ch) => (
        <section key={ch.chapter_id} className="card stack">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2 style={{ margin: 0 }}>{ch.chapter}</h2>
            {ch.unlocked ? <span className="badge badge-success">✓</span> : <span className="badge">🔒</span>}
          </div>
          {!ch.unlocked && <p className="muted small" style={{ margin: 0 }}>{t("lockedProjects")}</p>}
          {ch.unlocked && ch.projects.length === 0 && (
            <div><button className="btn btn-primary btn-sm" disabled={busy === ch.chapter_id} onClick={() => generate(ch.chapter_id)}>{t("suggestProjects")} (Alex)</button></div>
          )}
          {ch.projects.filter((pr) => pr.status !== "dismissed").map((pr) => (
            <div key={pr.id} className="section-block stack">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <h3 style={{ margin: 0 }}>{pr.title}</h3>
                <div className="row small"><span className="badge">{pr.difficulty}</span><span className="badge">{t("effort")}: {pr.effort_hours} h</span>{pr.status && <span className="badge badge-primary">{pr.status}</span>}</div>
              </div>
              <p style={{ margin: 0 }}>{pr.goal}</p>
              <div className="small"><strong>{t("steps")}:</strong><ol className="term-list">{pr.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></div>
              <div className="small"><strong>{t("materials")}:</strong> {pr.materials.join(", ")}</div>
              <div className="small"><strong>{t("successCriteria")}:</strong> {pr.success_criteria.join(" · ")}</div>
              {pr.status === "started" && <ProgressBar value={pr.progress / 100} label={pr.title} />}
              <div className="row">
                <button className="btn btn-sm" onClick={() => status(pr.id, "saved")}>{t("saveP")}</button>
                <button className="btn btn-sm" onClick={() => status(pr.id, "started", Math.min(90, pr.progress + 30))}>{t("startP")}{pr.status === "started" ? ` +30%` : ""}</button>
                <button className="btn btn-sm" onClick={() => status(pr.id, "completed")}>{t("completeP")}</button>
                <button className="btn btn-sm btn-ghost" onClick={() => status(pr.id, "dismissed")}>{t("dismissP")}</button>
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
