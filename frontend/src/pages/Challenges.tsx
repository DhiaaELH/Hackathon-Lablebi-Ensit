import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { qk, useChallenges, useInvalidate, useLeaderboard, usePublishable } from "../api/hooks";
import type { ChallengeResult, ChallengeSubmissionAdmin, ChallengeT, LevelT, OpenGradeT } from "../api/types";
import { Icon } from "../components/Icon";
import { Rich, texToPlain } from "../components/Rich";
import { useToast } from "../components/Toast";
import { Empty, ErrorBox, ProgressBar, Spinner, Tabs } from "../components/ui";
import { useI18n } from "../i18n/I18n";
import type { MessageKey } from "../i18n/messages";

type View = "challenges" | "leaderboard" | "publish";

/** Gamified challenges: teachers/tutors publish tasks and projects, an AI grader scores submissions, passing earns XP. */
export function Challenges() {
  const { t } = useI18n();
  const list = useChallenges();
  const [view, setView] = useState<View>("challenges");
  const canPublish = !!list.data?.can_publish;
  const tabs: { id: View; label: string; icon: string }[] = [
    { id: "challenges", label: t("chTab"), icon: "target" },
    { id: "leaderboard", label: t("chLeaderboard"), icon: "star" },
    ...(canPublish ? [{ id: "publish" as View, label: t("chPublish"), icon: "plus" }] : []),
  ];
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <header className="page-head">
        <h1>{t("challenges")}</h1>
        <p>{t("chIntro")}</p>
      </header>
      {list.data && <LevelCard me={list.data.me} passed={list.data.me.passed} />}
      <Tabs tabs={tabs} value={view} onChange={setView} />
      {view === "challenges" && (list.isLoading ? <Spinner /> : list.error ? <ErrorBox error={list.error} /> : <ChallengeList />)}
      {view === "leaderboard" && <LeaderboardView />}
      {view === "publish" && canPublish && <PublishForm onDone={() => setView("challenges")} />}
    </div>
  );
}

function LevelCard({ me, passed }: { me: LevelT; passed: number }) {
  const { t } = useI18n();
  const span = me.next_level_at - me.level_start;
  return (
    <div className="card level-card">
      <div className="level-badge" aria-hidden="true">{me.level}</div>
      <div className="stack" style={{ gap: "0.35rem", flex: 1, minWidth: 0 }}>
        <div className="row between">
          <strong>{t("chLevel")} {me.level}</strong>
          <span className="small muted">{me.xp} XP · {passed} {t("chPassedCount")}</span>
        </div>
        <ProgressBar value={(me.xp - me.level_start) / span} label={t("chNextLevel")} />
        <span className="small muted">{me.next_level_at - me.xp} XP {t("chToLevel")} {me.level + 1}</span>
      </div>
    </div>
  );
}

function ChallengeList() {
  const { t } = useI18n();
  const list = useChallenges();
  const [course, setCourse] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const d = list.data!;
  const courses = [...new Map(d.challenges.map((c) => [c.course_id, c.course_title])).entries()];
  const shown = d.challenges.filter((c) => !course || c.course_id === course);
  if (d.challenges.length === 0) return <Empty>{t(d.can_publish ? "chEmptyPublisher" : "chEmpty")}</Empty>;
  return (
    <div className="stack">
      {courses.length > 1 && (
        <select value={course} onChange={(e) => setCourse(e.target.value)} aria-label={t("communityCourse")} style={{ maxWidth: 460 }}>
          <option value="">{t("allMyCourses")}</option>
          {courses.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
        </select>
      )}
      {shown.map((c) => <ChallengeCard key={c.id} c={c} open={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)}
        passScore={d.pass_score} />)}
    </div>
  );
}

function ChallengeCard({ c, open, onToggle, passScore }: { c: ChallengeT; open: boolean; onToggle: () => void; passScore: number }) {
  const { t, lang } = useI18n();
  const closed = !!c.due_at && new Date(c.due_at).getTime() < Date.now();
  const locale = lang === "en" ? "en-GB" : lang === "fr" ? "fr-FR" : "ar-TN";
  return (
    <div className={`card stack challenge${c.passed ? " is-passed" : ""}`} style={{ gap: "0.5rem" }}>
      <div className="row between" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
        <div className="stack" style={{ gap: "0.25rem", minWidth: 0 }}>
          <span className="eyebrow">{c.course_title}{c.chapter_title ? ` · ${texToPlain(c.chapter_title)}` : ""}</span>
          <button type="button" className="feed-thread" onClick={onToggle} aria-expanded={open}><strong>{c.title}</strong></button>
        </div>
        <span className="xp-pill">+{c.xp} XP</span>
      </div>
      <div className="row small">
        <span className="badge">{t(c.kind === "project" ? "chProject" : "chTask")}</span>
        {c.passed && <span className="badge badge-success"><Icon name="check" size={12} /> {c.best_score}% · +{c.xp_earned} XP</span>}
        {!c.passed && c.best_score !== null && <span className="badge badge-warning">{c.best_score}%</span>}
        {c.due_at && <span className={`badge${closed ? " badge-error" : ""}`}><Icon name="calendar" size={12} /> {new Date(c.due_at).toLocaleDateString(locale)}</span>}
        <span className="muted">{c.author.display_name} · {t(`role_${c.author.role}` as MessageKey)}</span>
      </div>
      {!open && <button type="button" className="btn btn-sm" style={{ alignSelf: "flex-start" }} onClick={onToggle}>{t(c.mine || c.can_manage ? "open" : c.passed ? "chSeeResult" : "chStart")}</button>}
      {open && <ChallengeDetail c={c} closed={closed} passScore={passScore} />}
    </div>
  );
}

function GradeView({ g }: { g: OpenGradeT }) {
  const { t } = useI18n();
  return (
    <div className="stack" style={{ gap: "0.4rem" }}>
      <Rich as="p" text={g.feedback} />
      {g.met.length > 0 && <ul className="grade-list ok">{g.met.map((m, i) => <li key={i}><Icon name="check" size={13} /> <Rich text={m} /></li>)}</ul>}
      {g.missing.length > 0 && <ul className="grade-list no">{g.missing.map((m, i) => <li key={i}><Icon name="x" size={13} /> <Rich text={m} /></li>)}</ul>}
      {g.demo && <span className="tiny muted">{t("chDemoGrade")}</span>}
    </div>
  );
}

function ChallengeDetail({ c, closed, passScore }: { c: ChallengeT; closed: boolean; passScore: number }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const invalidate = useInvalidate();
  const [answer, setAnswer] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ChallengeResult | null>(null);
  const [subs, setSubs] = useState<ChallengeSubmissionAdmin[] | null>(null);
  const canSubmit = !c.mine && !closed && c.attempts_left > 0 && !(c.passed && c.best_score === 100);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.post<ChallengeResult>(`/api/challenges/${c.id}/submit`, { answer, link: link || null, language: lang }, 90_000);
      setResult(r);
      setAnswer("");
      setLink("");
      if (r.xp_gained > 0) toast(`+${r.xp_gained} XP · ${t("chLevel")} ${r.me.level}`);
      invalidate([...qk.challenges], [...qk.leaderboard]);
    } catch (err) {
      toast((err as Error).message === "timeout" ? t("novaTimeout") : (err as Error).message, "err");
    } finally {
      setBusy(false);
    }
  }
  async function archive() {
    if (!confirm(t("chArchiveConfirm"))) return;
    try {
      await api.del(`/api/challenges/${c.id}`);
      invalidate([...qk.challenges], [...qk.leaderboard]);
    } catch (err) { toast((err as Error).message, "err"); }
  }
  return (
    <div className="stack" style={{ gap: "0.8rem" }}>
      <Rich as="div" className="prose" text={c.instructions} />
      <div>
        <div className="sec-label">{t("chCriteria")}</div>
        <ul className="grade-list">{c.criteria.map((x, i) => <li key={i}><Icon name="target" size={13} /> <Rich text={x} /></li>)}</ul>
        <span className="tiny muted">{t("chHowGraded").replace("{pass}", String(passScore))}</span>
      </div>
      {result && (
        <div className={`alert ${result.passed ? "alert-success" : "alert-warning"} stack`}>
          <strong>{result.score}% · {result.passed ? `${t("chPassed")} · +${result.xp_gained} XP` : t("chNotYet")}</strong>
          <GradeView g={result} />
        </div>
      )}
      {canSubmit && (
        <form className="stack" onSubmit={submit}>
          <div className="field">
            <label htmlFor={`ans-${c.id}`}>{t("chYourWork")}</label>
            <textarea id={`ans-${c.id}`} required minLength={30} maxLength={10000} value={answer} onChange={(e) => setAnswer(e.target.value)}
              placeholder={t("chWorkHint")} style={{ minHeight: 160 }} />
          </div>
          <div className="field">
            <label htmlFor={`lnk-${c.id}`}>{t("chLink")}</label>
            <input id={`lnk-${c.id}`} type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
            <span className="tiny muted">{t("chLinkNote")}</span>
          </div>
          <div className="row">
            <button className="btn btn-primary" type="submit" disabled={busy || answer.trim().length < 30}>
              {busy ? <><span className="spinner" aria-hidden="true" /> {t("chGrading")}</> : <><Icon name="spark" size={15} /> {t("chSubmit")}</>}
            </button>
            <span className="small muted">{c.attempts_left} {t("chAttemptsLeft")}</span>
          </div>
        </form>
      )}
      {!canSubmit && !c.mine && !c.passed && <span className="small muted">{closed ? t("chClosed") : t("chNoAttempts")}</span>}
      {c.my_submissions.length > 0 && !result && (
        <details className="outline">
          <summary>{t("chMyAttempts")} ({c.my_submissions.length})</summary>
          <div className="stack" style={{ padding: "0.6rem 0.9rem" }}>
            {c.my_submissions.map((s) => (
              <div key={s.id} className="stack" style={{ gap: "0.3rem" }}>
                <strong className="small">{s.score}% {s.passed ? `· +${s.xp_awarded} XP` : ""}</strong>
                <GradeView g={s.grading} />
              </div>
            ))}
          </div>
        </details>
      )}
      {c.can_manage && (
        <div className="row">
          <button type="button" className="btn btn-sm" onClick={async () => setSubs(subs ? null : await api.get<ChallengeSubmissionAdmin[]>(`/api/challenges/${c.id}/submissions`))}>
            <Icon name="list" size={14} /> {t("chSubmissions")} ({c.submissions_count ?? 0})
          </button>
          <button type="button" className="btn btn-sm btn-danger" onClick={archive}><Icon name="trash" size={14} /> {t("chArchive")}</button>
        </div>
      )}
      {subs && (subs.length === 0 ? <Empty>{t("nothingHere")}</Empty> : (
        <div className="stack">
          {subs.map((s) => (
            <div key={s.id} className="card stack" style={{ gap: "0.3rem" }}>
              <div className="row between"><strong>{s.student.display_name}</strong>
                <span className={`badge ${s.passed ? "badge-success" : ""}`}>{s.score}%{s.passed ? ` · +${s.xp_awarded} XP` : ""}</span></div>
              <Rich as="div" className="small" text={s.answer} />
              {s.link && <a className="small" href={s.link} target="_blank" rel="noopener noreferrer nofollow">{s.link}</a>}
              <span className="small muted">{s.feedback}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function LeaderboardView() {
  const { t } = useI18n();
  const lb = useLeaderboard();
  if (lb.isLoading) return <Spinner />;
  if (!lb.data) return <ErrorBox error={lb.error} />;
  const d = lb.data;
  const meInTop = d.top.some((r) => r.me);
  const rows = meInTop || !d.me.rank ? d.top : [...d.top, d.me];
  const medal = (r: number | null) => (r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : r ?? "—");
  return (
    <div className="stack">
      <span className="small muted">{t("chLbIntro").replace("{n}", String(d.players))}</span>
      {d.top.length === 0 ? <Empty>{t("chLbEmpty")}</Empty> : (
        <div className="table-wrap card" style={{ padding: 0 }}>
          <table className="leaderboard">
            <thead><tr><th>#</th><th>{t("chPlayer")}</th><th>{t("chLevel")}</th><th>XP</th><th>{t("chPassedCount")}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.rank}-${r.username}`} className={r.me ? "is-me" : undefined}>
                  <td className="lb-rank">{medal(r.rank)}</td>
                  <td>{r.display_name
                    ? (r.username && !r.me ? <Link to={`/u/${r.username}`}>{r.display_name}</Link> : <strong>{r.display_name}</strong>)
                    : <span className="muted">{t("chAnonymous")}</span>}
                    {r.me && <span className="badge badge-primary" style={{ marginInlineStart: 6 }}>{t("chYou")}</span>}</td>
                  <td>{r.level}</td><td><strong>{r.xp}</strong></td><td>{r.passed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!d.me.rank && <span className="small muted">{t("chLbNotRanked")}</span>}
    </div>
  );
}

function PublishForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const courses = usePublishable(true);
  const invalidate = useInvalidate();
  const toast = useToast();
  const [courseId, setCourseId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [kind, setKind] = useState<"task" | "project">("task");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [criteria, setCriteria] = useState("");
  const [xp, setXp] = useState(50);
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  if (courses.isLoading) return <Spinner />;
  if (!courses.data) return <ErrorBox error={courses.error} />;
  if (courses.data.length === 0) return <Empty>{t("chNoPublishable")}</Empty>;
  const course = courses.data.find((c) => c.id === courseId);
  async function publish(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/api/challenges", {
        course_id: courseId, chapter_id: chapterId || null, kind, title, instructions, xp,
        criteria: criteria.split("\n").map((x) => x.trim()).filter(Boolean),
        due_at: due ? new Date(`${due}T23:59:59`).toISOString() : null,
      });
      await invalidate([...qk.challenges]);
      toast(t("chPublished"));
      onDone();
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="card stack" onSubmit={publish}>
      <div className="grid grid-2">
        <div className="field">
          <label htmlFor="ch-course">{t("communityCourse")}</label>
          <select id="ch-course" required value={courseId} onChange={(e) => { setCourseId(e.target.value); setChapterId(""); }}>
            <option value="" disabled>—</option>
            {courses.data.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ch-chapter">{t("chChapterOpt")}</label>
          <select id="ch-chapter" value={chapterId} onChange={(e) => setChapterId(e.target.value)} disabled={!course}>
            <option value="">{t("allChapters")}</option>
            {course?.chapters.map((h) => <option key={h.id} value={h.id}>{texToPlain(h.title)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-2">
        <div className="field">
          <label htmlFor="ch-kind">{t("chKind")}</label>
          <select id="ch-kind" value={kind} onChange={(e) => setKind(e.target.value as "task" | "project")}>
            <option value="task">{t("chTask")}</option>
            <option value="project">{t("chProject")}</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="ch-xp">{t("chReward")}</label>
          <select id="ch-xp" value={xp} onChange={(e) => setXp(Number(e.target.value))}>
            {[10, 25, 50, 100, 200].map((v) => <option key={v} value={v}>{v} XP</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="ch-title">{t("title")}</label>
        <input id="ch-title" type="text" required minLength={3} maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="ch-ins">{t("chInstructions")}</label>
        <textarea id="ch-ins" required minLength={10} maxLength={8000} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="ch-crit">{t("chCriteria")}</label>
        <textarea id="ch-crit" required value={criteria} onChange={(e) => setCriteria(e.target.value)} placeholder={t("chCriteriaHint")} style={{ minHeight: 110 }} />
        <span className="tiny muted">{t("chCriteriaNote")}</span>
      </div>
      <div className="field" style={{ maxWidth: 260 }}>
        <label htmlFor="ch-due">{t("chDue")}</label>
        <input id="ch-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      </div>
      <div><button className="btn btn-primary" type="submit" disabled={busy || !courseId}><Icon name="plus" size={15} /> {t("chPublishBtn")}</button></div>
    </form>
  );
}
