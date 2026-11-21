import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { qk, useDue, useInvalidate, useProgress, useRevision } from "../api/hooks";
import type { CourseDetail, DueCard, Revision as RevisionT } from "../api/types";
import { Icon } from "../components/Icon";
import { Rich } from "../components/Rich";
import { Citations, Empty, ErrorBox, QualityBadge, Spinner, Tabs } from "../components/ui";
import { useI18n } from "../i18n/I18n";

type Card = NonNullable<RevisionT["revision"]>["flashcards"][number];

/** 3D flip card. A div with role=button so the citation buttons inside are not nested in another button. */
function Flashcard({ c, course, big, flipped: ctrl, onFlip }: { c: Card; course: CourseDetail; big?: boolean; flipped?: boolean; onFlip?: (v: boolean) => void }) {
  const [own, setOwn] = useState(false);
  const flipped = ctrl ?? own;
  const toggle = () => (onFlip ? onFlip(!flipped) : setOwn((f) => !f));
  return (
    <div className={`flip${flipped ? " flipped" : ""}${big ? " big" : ""}`} role="button" tabIndex={0} aria-pressed={flipped} aria-label={c.front}
      onClick={toggle} onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(); } }}>
      <div className="flip-inner">
        <div className="flip-face"><span className="badge">{c.kind}</span><span className="front"><Rich text={c.front} /></span></div>
        <div className="flip-face flip-back">
          <Rich text={c.back} />
          <span onClick={(e) => e.stopPropagation()}><Citations refs={c.citations} map={course.refs} /></span>
        </div>
      </div>
    </div>
  );
}

function ReviewMode({ course }: { course: CourseDetail }) {
  const { t } = useI18n();
  const due = useDue(course.id);
  const invalidate = useInvalidate();
  const [queue, setQueue] = useState<DueCard[] | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  useEffect(() => { if (due.data && queue === null) setQueue(due.data.due); }, [due.data, queue]);
  const card = queue?.[0];
  async function grade(q: number) {
    if (!card) return;
    await api.post(`/api/courses/${course.id}/flashcards/review`, { key: card.key, quality: q });
    setFlipped(false);
    setDone((d) => d + 1);
    setQueue((qs) => (q < 3 && qs ? [...qs.slice(1), qs[0]] : qs?.slice(1) ?? []));
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea")) return;
      if (e.key === " ") { e.preventDefault(); setFlipped((f) => !f); }
      if (flipped && ["1", "2", "3", "4"].includes(e.key)) void grade([1, 3, 4, 5][Number(e.key) - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const finished = queue !== null && !card;
  useEffect(() => { if (finished && done) invalidate([...qk.due(course.id)]); }, [finished, done, invalidate, course.id]);
  if (due.isLoading || queue === null) return <Spinner />;
  if (!card) {
    return <Empty>{t("allDone")} {due.data?.next_due && <>· {t("nextReview")}: {due.data.next_due}</>}</Empty>;
  }
  return (
    <div className="stack review-card" style={{ maxWidth: 560, margin: "0 auto", width: "100%" }}>
      <div className="row between small muted"><span>{done} / {done + queue.length}</span>{card.new && <span className="badge badge-primary">new</span>}</div>
      <Flashcard c={card} course={course} big flipped={flipped} onFlip={setFlipped} />
      {flipped ? (
        <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: "0.4rem" }}>
          {([[1, t("again"), "btn-danger"], [3, t("hard"), ""], [4, t("good"), ""], [5, t("easy"), "btn-accent"]] as const).map(([q, label, cls], i) => (
            <button key={q} className={`btn ${cls}`} style={{ justifyContent: "center" }} onClick={() => grade(q)}>{label} <span className="kbd">{i + 1}</span></button>
          ))}
        </div>
      ) : (
        <button className="btn btn-primary" style={{ justifyContent: "center" }} onClick={() => setFlipped(true)}>{t("flip")} <span className="kbd" style={{ color: "inherit" }}>space</span></button>
      )}
    </div>
  );
}

function speak(text: string, lang: string, onEnd: () => void) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = { fr: "fr-FR", en: "en-US", ar: "ar-SA", derja: "ar-TN" }[lang] ?? "fr-FR";
  u.rate = 0.98;
  u.onend = onEnd;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

function Planner({ course }: { course: CourseDetail }) {
  const { t } = useI18n();
  const progress = useProgress(course.id);
  const [date, setDate] = useState("");
  const plan = useMemo(() => {
    if (!date) return null;
    const days = Math.max(1, Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000));
    const weak = new Set(progress.data?.concepts.filter((c) => c.trend === "needs practice").map((c) => c.name) ?? []);
    // weight = sections left (done sections count less) + weak concepts in the chapter; last day = mock exam
    const items = course.chapters.map((ch) => {
      const doneSecs = ch.sections.filter((s) => progress.data?.done_section_ids.includes(s.id)).length;
      const weakHere = course.concepts.filter((c) => ch.sections.some((s) => s.id === c.section_id) && weak.has(c.name)).length;
      return { ch, w: Math.max(0.5, ch.sections.length - doneSecs * 0.6 + weakHere) };
    });
    const studyDays = Math.max(1, days - 1);
    const total = items.reduce((s, i) => s + i.w, 0);
    const out: { day: number; label: string }[] = [];
    let cursor = 1;
    for (const it of items) {
      const n = Math.max(1, Math.round((it.w / total) * studyDays));
      for (let k = 0; k < n && cursor <= studyDays; k++) out.push({ day: cursor++, label: `${it.ch.title}${n > 1 ? ` (${k + 1}/${n})` : ""}` });
    }
    while (cursor <= studyDays) out.push({ day: cursor++, label: "Flashcards + quiz des chapitres faibles" });
    out.push({ day: days, label: t("mockExam") });
    return out;
  }, [date, course, progress.data, t]);
  return (
    <div className="stack">
      <div className="row" style={{ maxWidth: 420, flexWrap: "nowrap" }}>
        <label htmlFor="exam-date" className="small" style={{ whiteSpace: "nowrap" }}>{t("examDate")}</label>
        <input id="exam-date" type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} />
      </div>
      {plan && (
        <ol className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {plan.map((p) => {
            const d = new Date(Date.now() + p.day * 86_400_000);
            return (
              <li key={p.day} className="row small" style={{ borderTop: "1px solid var(--line)", paddingTop: 6, flexWrap: "nowrap" }}>
                <span className="kbd" style={{ minWidth: 92, textAlign: "center" }}>{d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span>
                <span>{p.label}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function downloadPack(course: CourseDetail, rev: NonNullable<RevisionT["revision"]>) {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const html = `<!doctype html><html lang="${course.language === "derja" ? "ar" : course.language}"><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${esc(course.title)} — study pack</title>
<style>body{font:16px/1.6 system-ui;max-width:760px;margin:2rem auto;padding:0 1rem;color:#1d2a2f;background:#f5f1e8}h1,h2{font-family:Georgia,serif}
details{background:#fff;border:1px solid #e2dacb;border-radius:10px;padding:.6rem .9rem;margin:.4rem 0}summary{cursor:pointer;font-weight:600}</style>
<h1>${esc(course.title)}</h1><p>LessonForge offline study pack · ${new Date().toLocaleDateString()}</p>
${rev.summaries.map((s) => `<h2>${esc(s.chapter_title)}</h2><ul>${s.bullets.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`).join("")}
<h2>Flashcards</h2>${rev.flashcards.map((f) => `<details><summary>${esc(f.front)}</summary>${esc(f.back)}</details>`).join("")}</html>`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  a.download = "lessonforge-study-pack.html";
  a.click();
  URL.revokeObjectURL(a.href);
}

export function RevisionTab({ course }: { course: CourseDetail }) {
  const { t, lang } = useI18n();
  const r = useRevision(course.id);
  const due = useDue(course.id);
  const [view, setView] = useState<"summary" | "cards" | "review" | "plan">("summary");
  const [speaking, setSpeaking] = useState<string | null>(null);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  if (r.isLoading) return <Spinner />;
  if (r.error) return <ErrorBox error={r.error} />;
  const rev = r.data?.revision;
  if (!rev) return <Empty>—</Empty>;
  const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
  const dueCount = due.data?.due.length ?? 0;
  return (
    <div className="stack" style={{ gap: "1rem" }}>
      <div className="row between">
        <QualityBadge status={r.data?.quality_status} />
        <div className="row">
          <button className="btn btn-sm" onClick={() => downloadPack(course, rev)}><Icon name="download" size={14} /> {t("studyPack")}</button>
          <a className="btn btn-sm btn-primary" href={`/api/courses/${course.id}/revision.pdf`} download><Icon name="file" size={14} /> PDF</a>
        </div>
      </div>
      <Tabs value={view} onChange={setView} tabs={[
        { id: "summary", label: t("summary"), icon: "book" }, { id: "cards", label: t("flashcards"), icon: "layers" },
        { id: "review", label: `${t("reviewMode")}${dueCount ? ` · ${dueCount}` : ""}`, icon: "target" }, { id: "plan", label: t("planner"), icon: "calendar" },
      ]} />
      {view === "summary" && rev.summaries.map((s) => {
        const text = `${s.chapter_title}. ${s.bullets.join(". ")}`;
        return (
          <section key={s.chapter_title} className="card stack">
            <div className="row between" style={{ flexWrap: "nowrap" }}>
              <h2 style={{ margin: 0 }}>{s.chapter_title}</h2>
              {canSpeak && (
                <button className="btn btn-sm btn-ghost" aria-pressed={speaking === s.chapter_title}
                  onClick={() => { if (speaking === s.chapter_title) { window.speechSynthesis.cancel(); setSpeaking(null); } else { setSpeaking(s.chapter_title); speak(text.replace(/\$/g, ""), lang, () => setSpeaking(null)); } }}>
                  <Icon name={speaking === s.chapter_title ? "stop" : "play"} size={14} /> {speaking === s.chapter_title ? t("stopListening") : t("listen")}
                </button>
              )}
            </div>
            <ul className="term-list">{s.bullets.map((b, i) => <li key={i}><Rich text={b} /></li>)}</ul>
            <div><Citations refs={s.citations} map={course.refs} /></div>
          </section>
        );
      })}
      {view === "cards" && <div className="grid grid-3">{rev.flashcards.map((c, i) => <Flashcard key={i} c={c} course={course} />)}</div>}
      {view === "review" && <ReviewMode course={course} />}
      {view === "plan" && <div className="card"><Planner course={course} /></div>}
    </div>
  );
}
