import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { qk, useNovaHistory, useQueryClient } from "../api/hooks";
import { Icon } from "../components/Icon";
import type { NovaHistoryItem, NovaReply, RefT } from "../api/types";
import { AGENT_INITIAL, AGENT_NAME, Citations } from "../components/ui";
import { useI18n } from "../i18n/I18n";
import type { MessageKey } from "../i18n/messages";
import { Rich } from "../components/Rich";

export type NovaMode = "ask" | "socratic" | "hint" | "answer" | "alternate" | "explain_mistake" | "mini_lesson";
export interface NovaRequest {
  nonce: number;
  message: string;
  mode: NovaMode;
  question_id?: string;
  chosen_index?: number;
  concept_id?: string;
}

interface Line {
  key: string;
  role: "user" | "assistant";
  agent?: string | null;
  handoff?: string;
  text: string;
  citations: string[];
  supported?: boolean | null;
  demo?: boolean;
  action?: { open: string } | null;
}

const MODES: NovaMode[] = ["ask", "socratic", "hint", "answer", "alternate"];
const SUGGESTIONS: Record<string, { text: string; mode: NovaMode }[]> = {
  fr: [{ text: "Résume-moi le chapitre 1", mode: "ask" }, { text: "Quels sont les prérequis ?", mode: "ask" }, { text: "Pose-moi une question pour vérifier", mode: "socratic" }],
  en: [{ text: "Summarise chapter 1 for me", mode: "ask" }, { text: "What are the prerequisites?", mode: "ask" }, { text: "Quiz me with one question", mode: "socratic" }],
  ar: [{ text: "لخّص لي الفصل الأول", mode: "ask" }, { text: "ما هي المتطلبات السابقة؟", mode: "ask" }, { text: "اسألني سؤالًا للتحقق", mode: "socratic" }],
  derja: [{ text: "فسّرلي الفصل الأول", mode: "ask" }, { text: "شنوّة لازمني نعرف قبل؟", mode: "ask" }, { text: "اسألني سؤال باش نثبّت", mode: "socratic" }],
};

export function NovaPanel({ courseId, refs, request, onOpenTab }: {
  courseId: string;
  refs: Record<string, RefT> | undefined;
  request: NovaRequest | null;
  onOpenTab: (tab: string) => void;
}) {
  const { t, lang } = useI18n();
  const history = useNovaHistory(courseId);
  const qc = useQueryClient();
  const [lines, setLines] = useState<Line[]>([]);
  const [mode, setMode] = useState<NovaMode>("ask");
  const [elapsed, setElapsed] = useState(0);
  const [failed, setFailed] = useState<Omit<NovaRequest, "nonce"> | null>(null);
  const [hintLevel, setHintLevel] = useState(1);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const lastQuestion = useRef<string>("");
  const logRef = useRef<HTMLDivElement>(null);
  const handled = useRef<number>(0);

  useEffect(() => {
    if (history.data && lines.length === 0) {
      setLines(history.data.map((m: NovaHistoryItem) => ({ key: `h${m.id}`, role: m.role, agent: m.agent_role, text: m.content, citations: m.citations, demo: m.demo })));
      const lastUser = [...history.data].reverse().find((m) => m.role === "user");
      if (lastUser) lastQuestion.current = lastUser.content;
    }
  }, [history.data, lines.length]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, busy]);

  useEffect(() => {
    if (!busy) return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [busy]);

  async function send(req: Omit<NovaRequest, "nonce">, isRetry = false) {
    setBusy(true);
    setFailed(null);
    if (!isRetry) setLines((l) => [...l, { key: `u${Date.now()}`, role: "user", text: req.message, citations: [] }]);
    try {
      const body: Record<string, unknown> = { message: req.message, mode: req.mode, language: lang };
      if (req.mode === "hint") body.hint_level = hintLevel;
      if (req.question_id) body.question_id = req.question_id;
      if (req.chosen_index !== undefined) body.chosen_index = req.chosen_index;
      if (req.concept_id) body.concept_id = req.concept_id;
      const r = await api.post<{ routed_to: string[]; replies: NovaReply[] }>(`/api/courses/${courseId}/nova`, body, 90_000);
      setLines((l) => [...l, ...r.replies.map((rep, i) => ({
        key: `a${Date.now()}-${i}`, role: "assistant" as const, agent: rep.agent_role, handoff: rep.handoff, text: rep.message,
        citations: rep.citations, supported: rep.supported, demo: rep.demo, action: rep.action,
      }))]);
      if (req.mode === "hint") setHintLevel((h) => Math.min(3, h + 1));
      if (r.replies.some((x) => x.error)) setFailed(req);
      qc.invalidateQueries({ queryKey: qk.nova(courseId), refetchType: "none" });
    } catch (e) {
      const msg = (e as Error).message === "timeout" ? t("novaTimeout") : `${t("error")}: ${(e as Error).message}`;
      setLines((l) => [...l, { key: `e${Date.now()}`, role: "assistant", agent: "nova", text: msg, citations: [] }]);
      setFailed(req);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (request && request.nonce !== handled.current) {
      handled.current = request.nonce;
      void send(request);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const msg = text.trim() || (mode === "alternate" || mode === "hint" ? lastQuestion.current : "");
    if (!msg) return;
    if (text.trim()) {
      lastQuestion.current = text.trim();
      if (mode !== "hint") setHintLevel(1);
    }
    setText("");
    void send({ message: msg, mode });
  }

  return (
    <aside className="card nova" aria-label="Nova">
      <div className="nova-head">
        <span className={`nova-orb${busy ? " busy" : ""}`} aria-hidden="true" />
        <div>
          <strong style={{ fontFamily: "var(--display)", fontSize: "1.05rem" }}>Nova</strong>
          <div className="tiny muted">Sam · Clara · Alex · Quinn · Sage · Max · Jordan</div>
        </div>
      </div>
      <div className="nova-log" ref={logRef} aria-live="polite">
        <div className="msg msg-bot" style={{ borderStyle: "dashed" }}>{t("novaHello")}{lang === "derja" && <div className="small muted" style={{ marginTop: 6 }}>{t("derjaNote")}</div>}</div>
        {lines.map((l) => (
          <div key={l.key} className={`msg ${l.role === "user" ? "msg-user" : "msg-bot"}`}>
            {l.role === "assistant" && (
              <div className="handoff">
                <span className="avatar" style={{ width: 18, height: 18, fontSize: 9, display: "inline-grid", marginInlineEnd: 4 }} aria-hidden="true">{AGENT_INITIAL[l.agent ?? "nova"]}</span>
                {l.handoff ?? AGENT_NAME[l.agent ?? "nova"]}
                {l.demo && <span className="badge badge-warning" style={{ marginInlineStart: 6 }}>{t("demo")}</span>}
                {l.supported === false && <span className="badge badge-error" style={{ marginInlineStart: 6 }}>{t("notInCourse")}</span>}
              </div>
            )}
            <Rich text={l.text} />
            {l.citations?.length > 0 && <div style={{ marginTop: 6 }}><Citations refs={l.citations} map={refs} /></div>}
            {l.action && <div style={{ marginTop: 6 }}><button className="btn btn-sm" onClick={() => onOpenTab(l.action!.open)}>{t("open")} <Icon name="arrow" size={13} /></button></div>}
          </div>
        ))}
        {lines.length === 0 && !busy && (
          <div className="stack" style={{ gap: 6 }}>
            <span className="tiny muted">{t("tryAsk")}</span>
            <div className="suggest">
              {SUGGESTIONS[lang].map((sg) => <button key={sg.text} className="chip" onClick={() => { setMode(sg.mode); void send({ message: sg.text, mode: sg.mode }); }}>{sg.text}</button>)}
            </div>
          </div>
        )}
        {busy && <div className="msg msg-bot muted" role="status"><span className="spinner" aria-hidden="true" /> {t("thinking")} {elapsed > 2 ? `${elapsed}s` : ""}{elapsed > 20 ? ` — ${t("slowModel")}` : ""}</div>}
        {failed && !busy && <div><button className="btn btn-sm" onClick={() => send(failed, true)}>{t("retry")}</button></div>}
      </div>
      <form className="nova-foot" onSubmit={submit}>
        <div className="mode-row" role="radiogroup" aria-label="Mode">
          {MODES.map((m) => (
            <button key={m} type="button" className="chip" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}>
              {t(`mode_${m}` as MessageKey)}{m === "hint" && mode === "hint" ? ` ${hintLevel}/3` : ""}
            </button>
          ))}
        </div>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <label htmlFor="nova-input" className="sr-only">{t("askPlaceholder")}</label>
          <input id="nova-input" type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("askPlaceholder")} maxLength={4000} />
          <button className="btn btn-primary" disabled={busy} type="submit" aria-label={t("send")}><Icon name="arrow" size={16} /></button>
        </div>
      </form>
    </aside>
  );
}
