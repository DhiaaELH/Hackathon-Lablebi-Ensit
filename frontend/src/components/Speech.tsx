import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useI18n } from "../i18n/I18n";
import { Icon } from "./Icon";

/**
 * Text-to-speech built on the browser's Web Speech API (no server, no cost).
 * - Picks a FEMALE voice for the current language, preferring high-quality "natural/neural/online" voices.
 * - Speed control (0.75×–1.5×) and voice choice are remembered per browser.
 * - Math written as LaTeX ($...$) is turned into speakable words before reading.
 */
const LANG_TAG: Record<string, string[]> = { fr: ["fr-FR", "fr"], en: ["en-US", "en-GB", "en"], ar: ["ar-SA", "ar"], derja: ["ar-TN", "ar", "fr-FR", "fr"] };
const FEMALE = /female|femme|woman|amélie|amelie|audrey|aurélie|aurelie|marie|julie|léa|lea\b|virginie|hortense|denise|eloise|élise|elise|celine|céline|chantal|sylvie|brigitte|vivienne|coralie|jacqueline|joséphine|yvette|google français|google us english|google uk english female|samantha|victoria|karen|moira|tessa|fiona|serena|susan|zira|aria|jenny|michelle|emma|ava|allison|joanna|salli|kendra|kimberly|ivy|hoda|salma|zariyah|amina|laila|mariam|zeina|sana|fatima|reem|layla/i;
const MALE = /\bmale\b|homme|thomas|daniel|paul|henri|claude|jean|nicolas|alex\b|fred|david|mark|guy|james|george|hamed|naayf|tarik|shakir|maged/i;
const QUALITY = /natural|neural|online|enhanced|premium|google/i;

function scoreVoice(v: SpeechSynthesisVoice, tags: string[]): number {
  const li = tags.findIndex((t) => v.lang.toLowerCase().startsWith(t.toLowerCase()));
  if (li < 0) return -1;
  let s = 100 - li * 10;
  if (FEMALE.test(v.name)) s += 40;
  if (MALE.test(v.name) && !FEMALE.test(v.name)) s -= 50;
  if (QUALITY.test(v.name)) s += 25;
  if (!v.localService) s += 5; // cloud voices are usually clearer
  return s;
}

/** LaTeX / symbols → words, so the voice doesn't read "dollar backslash frac". */
export function speakable(text: string, lang: string): string {
  const fr = lang === "fr" || lang === "derja";
  const W = fr
    ? { over: " sur ", sq: " au carré", cube: " au cube", pow: " puissance ", sqrt: "racine de ", int: "intégrale de ", sum: "somme de ", times: " fois ", le: " inférieur ou égal à ", ge: " supérieur ou égal à ", ne: " différent de ", to: " tend vers ", inf: "l'infini", prime: " prime", minus: " moins ", plus: " plus ", eq: " égale " }
    : { over: " over ", sq: " squared", cube: " cubed", pow: " to the power ", sqrt: "square root of ", int: "integral of ", sum: "sum of ", times: " times ", le: " less than or equal to ", ge: " greater than or equal to ", ne: " not equal to ", to: " tends to ", inf: "infinity", prime: " prime", minus: " minus ", plus: " plus ", eq: " equals " };
  const math = (m: string) =>
    m
      .replace(/\\left|\\right/g, "")
      .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, `$1${W.over}$2`)
      .replace(/\\sqrt\{([^{}]*)\}/g, `${W.sqrt}$1`)
      .replace(/\^\{?2\}?/g, W.sq).replace(/\^\{?3\}?/g, W.cube)
      .replace(/\^\{([^{}]*)\}/g, `${W.pow}$1`).replace(/\^(\w)/g, `${W.pow}$1`)
      .replace(/\\int/g, W.int).replace(/\\sum/g, W.sum).replace(/\\(cdot|times)/g, W.times)
      .replace(/\\leq?/g, W.le).replace(/\\geq?/g, W.ge).replace(/\\neq/g, W.ne).replace(/\\to|\\rightarrow/g, W.to).replace(/\\infty/g, W.inf)
      .replace(/'/g, W.prime).replace(/=/g, W.eq).replace(/\+/g, W.plus).replace(/(\s)-(\s)/g, `$1${W.minus}$2`)
      .replace(/\\[a-zA-Z]+/g, " ").replace(/[{}_]/g, " ");
  return text
    .replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => `, ${math(m)}, `)
    .replace(/\$([^$]+)\$/g, (_, m) => math(m))
    .replace(/\*\*/g, "")
    .replace(/\[S\d+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

interface SpeechCtx {
  supported: boolean;
  speakingId: string | null;
  speak: (id: string, text: string) => void;
  stop: () => void;
  rate: number;
  setRate: (r: number) => void;
  voices: SpeechSynthesisVoice[];
  voice: SpeechSynthesisVoice | null;
  setVoiceName: (n: string) => void;
}
const Ctx = createContext<SpeechCtx | null>(null);
const read = (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export function SpeechProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [all, setAll] = useState<SpeechSynthesisVoice[]>([]);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [rate, setRateState] = useState(() => Number(read("lf.tts.rate", "0.95")) || 0.95);
  const [voiceName, setVoiceNameState] = useState(() => read(`lf.tts.voice.${lang}`, ""));
  const keepAlive = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!supported) return;
    const load = () => setAll(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [supported]);
  useEffect(() => setVoiceNameState(read(`lf.tts.voice.${lang}`, "")), [lang]);

  const tags = LANG_TAG[lang] ?? LANG_TAG.fr;
  const voices = useMemo(() => all.filter((v) => scoreVoice(v, tags) >= 0).sort((a, b) => scoreVoice(b, tags) - scoreVoice(a, tags)), [all, tags]);
  const voice = voices.find((v) => v.name === voiceName) ?? voices[0] ?? null;

  const stop = useCallback(() => {
    if (!supported) return;
    window.clearInterval(keepAlive.current);
    window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, [supported]);

  const speak = useCallback((id: string, text: string) => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    window.clearInterval(keepAlive.current);
    // Split into sentences: shorter utterances sound more natural and avoid Chrome's ~15s cut-off.
    const chunks = speakable(text, lang).match(/[^.!?؟\n]+[.!?؟]?/g)?.map((c) => c.trim()).filter(Boolean) ?? [];
    if (!chunks.length) return;
    setSpeakingId(id);
    chunks.forEach((chunk, i) => {
      const u = new SpeechSynthesisUtterance(chunk);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? tags[0];
      u.rate = rate;
      u.pitch = 1.08; // slightly brighter = clearer on small speakers
      u.volume = 1;
      if (i === chunks.length - 1) {
        u.onend = () => { window.clearInterval(keepAlive.current); setSpeakingId((cur) => (cur === id ? null : cur)); };
      }
      u.onerror = () => setSpeakingId((cur) => (cur === id ? null : cur));
      window.speechSynthesis.speak(u);
    });
    keepAlive.current = window.setInterval(() => { // Chrome pauses long queues; nudge it
      if (!window.speechSynthesis.speaking) window.clearInterval(keepAlive.current);
      else { window.speechSynthesis.pause(); window.speechSynthesis.resume(); }
    }, 10_000);
  }, [supported, lang, voice, rate, tags]);

  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);

  const value: SpeechCtx = {
    supported, speakingId, speak, stop, rate, voices, voice,
    setRate: (r) => { setRateState(r); write("lf.tts.rate", String(r)); },
    setVoiceName: (n) => { setVoiceNameState(n); write(`lf.tts.voice.${lang}`, n); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSpeech() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSpeech outside provider");
  return v;
}

/** Play/stop button for one piece of text. */
export function SpeakButton({ id, text, label, small = true }: { id: string; text: string; label?: string; small?: boolean }) {
  const s = useSpeech();
  const { t } = useI18n();
  if (!s.supported) return null;
  const on = s.speakingId === id;
  return (
    <button type="button" className={`btn ${small ? "btn-sm" : ""} btn-ghost speak-btn${on ? " on" : ""}`} aria-pressed={on}
      aria-label={on ? t("stopListening") : t("listen")} title={s.voice ? `${s.voice.name} · ${s.rate}×` : undefined}
      onClick={(e) => { e.stopPropagation(); if (on) s.stop(); else s.speak(id, text); }}>
      {on ? <span className="eq" aria-hidden="true"><i /><i /><i /></span> : <Icon name="play" size={13} />}
      {label !== undefined ? label : on ? t("stopListening") : t("listen")}
    </button>
  );
}

/** Speed + voice settings (shown wherever reading aloud is available). */
export function SpeechSettings() {
  const s = useSpeech();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (!s.supported) return null;
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button type="button" className="btn btn-sm btn-ghost" aria-expanded={open} onClick={() => setOpen((o) => !o)} title={t("voiceSettings")}>
        <Icon name="gear" size={14} /> {s.rate}×
      </button>
      {open && (
        <div className="card stack small popover" role="dialog" aria-label={t("voiceSettings")}>
          <strong>{t("voiceSettings")}</strong>
          <div className="stack" style={{ gap: 4 }}>
            <span className="tiny muted">{t("speed")}</span>
            <div className="chips">
              {[0.75, 0.9, 1, 1.15, 1.3, 1.5].map((r) => (
                <button key={r} type="button" className="chip" aria-pressed={s.rate === r} onClick={() => s.setRate(r)}>{r}×</button>
              ))}
            </div>
          </div>
          <label className="stack" style={{ gap: 4 }}>
            <span className="tiny muted">{t("voice")}</span>
            <select value={s.voice?.name ?? ""} onChange={(e) => s.setVoiceName(e.target.value)}>
              {s.voices.map((v) => (
                <option key={v.name} value={v.name}>{FEMALE.test(v.name) ? "♀ " : ""}{v.name} ({v.lang})</option>
              ))}
            </select>
          </label>
          {s.voices.length === 0 && <span className="tiny muted">{t("noVoice")}</span>}
          <button type="button" className="btn btn-sm" onClick={() => s.speak("__test", t("voiceTest"))}><Icon name="play" size={13} /> {t("listen")}</button>
        </div>
      )}
    </div>
  );
}
