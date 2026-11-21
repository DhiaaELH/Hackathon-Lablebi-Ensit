import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../api/client";
import { useNovaHistory } from "../api/hooks";
import type { NovaHistoryItem, NovaReply, RefT } from "../api/types";
import { AGENT_INITIAL, AGENT_NAME, Citations } from "../components/ui";
import { useI18n } from "../i18n/I18n";
import type { MessageKey } from "../i18n/messages";

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

export function NovaPanel({ courseId, refs, request, onOpenTab }: {
  courseId: string;
  refs: Record<string, RefT> | undefined;
  request: NovaRequest | null;
  onOpenTab: (tab: string) => void;
}) {
  const { t, lang } = useI18n();
  const history = useNovaHistory(courseId);
  const [lines, setLines] = useState<Line[]>([]);
  const [mode, setMode] = useState<NovaMode>("socratic");
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

  async function send(req: Omit<NovaRequest, "nonce">) {
    setBusy(true);
    setLines((l) => [...l, { key: `u${Date.now()}`, role: "user", text: req.message, citations: [] }]);
    try {
      const body: Record<string, unknown> = { message: req.message, mode: req.mode, language: lang };
      if (req.mode === "hint") body.hint_level = hintLevel;
      if (req.question_id) body.question_id = req.question_id;
      if (req.chosen_index !== undefined) body.chosen_index = req.chosen_index;
      if (req.concept_id) body.concept_id = req.concept_id;
      const r = await api.post<{ routed_to: string[]; replies: NovaReply[] }>(`/api/courses/${courseId}/nova`, body);
      setLines((l) => [...l, ...r.replies.map((rep, i) => ({
        key: `a${Date.now()}-${i}`, role: "assistant" as const, agent: rep.agent_role, handoff: rep.handoff, text: rep.message,
        citations: rep.citations, supported: rep.supported, demo: rep.demo, action: rep.action,
      }))]);
      if (req.mode === "hint") setHintLevel((h) => Math.min(3, h + 1));
    } catch (e) {
      setLines((l) => [...l, { key: `e${Date.now()}`, role: "assistant", agent: "nova", text: `${t("error")}: ${(e as Error).message}`, citations: [] }]);
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
        <span className="avatar" aria-hidden="true">N</span>
        <div>
          <strong>Nova</strong>
          <div className="small muted">Sam · Clara · Alex · Quinn · Sage · Max · Jordan</div>
        </div>
      </div>
      <div className="nova-log" ref={logRef} aria-live="polite">
        <div className="msg msg-bot">{t("novaHello")}{lang === "derja" && <div className="small muted" style={{ marginTop: 6 }}>{t("derjaNote")}</div>}</div>
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
            {l.text}
            {l.citations?.length > 0 && <div style={{ marginTop: 6 }}><Citations refs={l.citations} map={refs} /></div>}
            {l.action && <div style={{ marginTop: 6 }}><button className="btn btn-sm" onClick={() => onOpenTab(l.action!.open)}>{t("open")} →</button></div>}
          </div>
        ))}
        {busy && <div className="msg msg-bot muted">{t("thinking")}</div>}
      </div>
      <form className="nova-foot" onSubmit={submit}>
        <div className="mode-row" role="radiogroup" aria-label="Mode">
          {MODES.map((m) => (
            <button key={m} type="button" className="chip" role="radio" aria-checked={mode === m} aria-pressed={mode === m} onClick={() => setMode(m)}>
              {t(`mode_${m}` as MessageKey)}{m === "hint" && mode === "hint" ? ` ${hintLevel}/3` : ""}
            </button>
          ))}
        </div>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <label htmlFor="nova-input" className="sr-only">{t("askPlaceholder")}</label>
          <input id="nova-input" type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder={t("askPlaceholder")} maxLength={4000} />
          <button className="btn btn-primary" disabled={busy} type="submit">{t("send")}</button>
        </div>
      </form>
    </aside>
  );
}
