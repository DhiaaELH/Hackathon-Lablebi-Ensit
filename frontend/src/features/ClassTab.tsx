import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { qk, useInvalidate, useMembers } from "../api/hooks";
import type { CourseDetail, MemberT } from "../api/types";
import { Icon } from "../components/Icon";
import { initials } from "../components/Layout";
import { useToast } from "../components/Toast";
import { Empty, ErrorBox, Spinner } from "../components/ui";
import { useI18n } from "../i18n/I18n";
import type { MessageKey } from "../i18n/messages";

/** Teacher view of a course as a classroom: who is in it, add / remove students, message the whole class. */
export function ClassTab({ course }: { course: CourseDetail }) {
  const { t, tf } = useI18n();
  const members = useMembers(course.id);
  const invalidate = useInvalidate();
  const toast = useToast();
  const [who, setWho] = useState("");
  const [asTeacher, setAsTeacher] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const isOwner = course.access === "owner";

  async function run(fn: () => Promise<unknown>, done?: string) {
    setBusy(true);
    try {
      await fn();
      await invalidate([...qk.members(course.id)]);
      if (done) toast(done);
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  }
  async function add(e: FormEvent) {
    e.preventDefault();
    await run(() => api.post(`/api/courses/${course.id}/members`, { identifier: who.trim(), member_role: asTeacher ? "teacher" : "student" }), t("added"));
    setWho("");
  }
  function remove(m: MemberT) {
    if (!confirm(tf("removeFromClassConfirm", { name: m.display_name }))) return;
    void run(() => api.del(`/api/courses/${course.id}/members/${encodeURIComponent(m.username)}`), t("removedOk"));
  }
  async function announce(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post<{ sent: number }>(`/api/courses/${course.id}/announcements`, { title, body });
      toast(tf("announceSent", { n: r.sent }));
      setTitle(""); setBody("");
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack" style={{ gap: "1rem", maxWidth: 820 }}>
      <section className="card stack">
        <div className="row between">
          <h2 style={{ margin: 0 }}>{t("roster")}</h2>
          {members.data && <span className="badge"><Icon name="users" size={12} /> {members.data.length}</span>}
        </div>
        <p className="small muted" style={{ margin: 0 }}>{t("classIntro")}</p>
        <form className="row" onSubmit={add}>
          <input type="text" required minLength={2} maxLength={320} value={who} onChange={(e) => setWho(e.target.value)} placeholder={t("usernameOrEmail")}
            aria-label={t("usernameOrEmail")} style={{ flex: 1, minWidth: 200 }} autoCapitalize="none" autoCorrect="off" />
          <button className="btn btn-primary" type="submit" disabled={busy}><Icon name="plus" size={14} /> {t("addStudent")}</button>
          {isOwner && <label className="check small" style={{ flexBasis: "100%" }}><input type="checkbox" checked={asTeacher} onChange={(e) => setAsTeacher(e.target.checked)} /> {t("addAsCoTeacher")}</label>}
        </form>
        {members.isLoading && <Spinner />}
        {members.error && <ErrorBox error={members.error} />}
        {members.data?.length === 0 && <Empty>{t("noStudents")}</Empty>}
        <div>
          {members.data?.map((m) => (
            <div key={m.username} className="roster-row">
              <span className="avatar">{initials(m.display_name)}</span>
              <div className="grow">
                <Link to={`/u/${m.username}`} style={{ fontWeight: 600, color: "var(--ink)" }}>{m.display_name}</Link>
                <div className="tiny muted">@{m.username} · {t(`role_${m.role}` as MessageKey)}</div>
              </div>
              {m.member_role === "teacher" && <span className="badge badge-success">{t("coTeacher")}</span>}
              {(m.member_role !== "teacher" || isOwner) && (
                <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={() => remove(m)} title={t("removeFromClass")}>
                  <Icon name="x" size={13} /> <span className="hide-sm">{t("removeFromClass")}</span>
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
      <form className="card stack" onSubmit={announce}>
        <h2 style={{ margin: 0 }}>{t("announce")}</h2>
        <input type="text" required minLength={3} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("title")} aria-label={t("title")} />
        <textarea value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} placeholder={t("announceBody")} aria-label={t("announceBody")} style={{ minHeight: 90 }} />
        <div><button className="btn btn-primary" type="submit" disabled={busy || !members.data?.length}><Icon name="bell" size={14} /> {t("announceSend")}</button></div>
      </form>
    </div>
  );
}
