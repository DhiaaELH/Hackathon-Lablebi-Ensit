import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { qk, useQueryClient } from "../api/hooks";
import type { Me } from "../api/types";
import { Constellation, GROUPS, type ConstellationHandle, type HoverInfo } from "../components/Constellation";
import { Icon } from "../components/Icon";
import { LanguageSwitch } from "../components/Layout";
import { ErrorBox } from "../components/ui";
import { useI18n } from "../i18n/I18n";

const DEMO = [
  ["student@demo.lessonforge.local", "Student"],
  ["senior@demo.lessonforge.local", "Tutor"],
  ["teacher@demo.lessonforge.local", "Teacher"],
  ["moderator@demo.lessonforge.local", "Moderator"],
];

const HERO: Record<string, { lead: string; em: string; tail: string; body: string }> = {
  fr: { lead: "Tes notes de cours,", em: "enfin", tail: "vivantes.", body: "Importe ton cours : LessonForge le structure, t'entraîne avec de vrais exercices, t'explique en Derja ou en français, et aide ta classe à savoir où ça bloque — sans jamais exposer qui." },
  en: { lead: "Your course notes,", em: "finally", tail: "alive.", body: "Upload a course: LessonForge structures it, trains you with real exercises, explains in Derja, French, English or Arabic, and helps your class see where it gets stuck — without ever exposing who." },
  ar: { lead: "ملاحظات درسك،", em: "أخيرًا", tail: "حيّة.", body: "ارفع درسك: ينظّمه LessonForge، ويدرّبك بتمارين حقيقية، ويشرح لك بالدارجة أو الفرنسية، ويساعد قسمك على معرفة مواضع الصعوبة — دون كشف أي هوية." },
  derja: { lead: "النوتات متاعك،", em: "أخيرًا", tail: "فيها الروح.", body: "حمّل الكور متاعك: LessonForge ينظّمو، يدرّبك بتمارين حقيقية، يفسّرلك بالدارجة ولا بالفرنسي، ويعاون القسم يعرف وين الصعوبة — بلاش ما يتعرف شكون." },
};
const PRAISE = ["Bien vu !", "Exactement.", "Joli lien !", "Tu as l'œil.", "Connexion établie.", "Bravo !"];

/** Each letter is its own span so the headline ripples like a wave on hover. */
function Wave({ text, className }: { text: string; className?: string }) {
  let i = 0;
  const words = text.split(" ");
  return (
    <span className={`wave ${className ?? ""}`} aria-label={text}>
      {words.map((word, wi) => (
        <span key={wi}>
          <span className="w" aria-hidden="true">
            {[...word].map((ch) => { const k = i++; return <span key={k} style={{ ["--i" as string]: k }}>{ch}</span>; })}
          </span>
          {wi < words.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}

export function AuthPage() {
  const { t, lang, setLang } = useI18n();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [teacher, setTeacher] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [links, setLinks] = useState(0);
  const [toast, setToast] = useState<{ text: string; ok: boolean; id: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const sky = useRef<ConstellationHandle>(null);
  const typing = useRef<number | null>(null);
  const qc = useQueryClient();
  const nav = useNavigate();
  const hero = HERO[lang] ?? HERO.fr;

  useEffect(() => () => { if (typing.current) window.clearTimeout(typing.current); }, []);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  /** Launch the typed character (or a mask for secrets) from the caret position into the canvas. */
  function launch(e: ChangeEvent<HTMLInputElement>, secret = false) {
    const el = e.target;
    const r = el.getBoundingClientRect();
    const ch = secret ? "∗" : (el.value.slice(-1) || "·");
    const x = r.left + Math.min(r.width - 14, 14 + el.value.length * 7.6);
    sky.current?.type(ch, { x, y: r.top + r.height / 2 });
  }

  function typeInto(target: string, pw: string) {
    if (typing.current) window.clearTimeout(typing.current);
    setMode("in");
    setEmail("");
    setPassword("");
    const emailEl = document.getElementById("email");
    const pwEl = document.getElementById("pw");
    let i = 0;
    const tick = () => {
      if (i < target.length) {
        i += 1;
        setEmail(target.slice(0, i));
        const r = emailEl?.getBoundingClientRect();
        if (r && i % 2 === 0) sky.current?.type(target[i - 1], { x: r.left + Math.min(r.width - 14, 14 + i * 7.6), y: r.top + r.height / 2 });
        typing.current = window.setTimeout(tick, 18);
      } else if (i < target.length + pw.length) {
        i += 1;
        setPassword(pw.slice(0, i - target.length));
        const r = pwEl?.getBoundingClientRect();
        if (r) sky.current?.type("∗", { x: r.left + 14 + (i - target.length) * 7.6, y: r.top + r.height / 2 });
        typing.current = window.setTimeout(tick, 22);
      } else {
        typing.current = null;
        (document.querySelector("form.auth-card button[type=submit]") as HTMLButtonElement | null)?.focus();
      }
    };
    tick();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const me = mode === "in"
        ? await api.post<Me>("/api/auth/login", { email, password })
        : await api.post<Me>("/api/auth/register", { email, password, display_name: name, locale: lang, role: teacher ? "teacher" : "student", teacher_code: teacher ? code : null });
      sky.current?.scatter();
      qc.setQueryData(qk.me, me);
      if (mode === "in" && me.locale) setLang(me.locale);
      window.setTimeout(() => nav("/"), 380);
    } catch (e2) {
      setErr(e2);
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <Constellation
        ref={sky}
        onHover={setHover}
        onSelect={(c) => setSelected(c ? c.label : null)}
        onLink={(n, a, b) => {
          setLinks(n);
          setToast({ text: `${PRAISE[n % PRAISE.length]} ${a.label} ↔ ${b.label} · ${GROUPS[a.group]}`, ok: true, id: Date.now() });
        }}
        onMiss={() => setToast({ text: "Pas la même matière — essaie encore", ok: false, id: Date.now() })}
      />
      {hover && (
        <div className="concept-card" style={{ left: hover.x, top: hover.y }} role="tooltip">
          <span className="eyebrow">{GROUPS[hover.group]}</span>
          <strong>{hover.label}</strong>
          <span className="small">{hover.def}</span>
        </div>
      )}
      <section className="auth-hero" aria-label="LessonForge">
        <div className="row"><span className="brand-mark" aria-hidden="true">L</span><span className="eyebrow">LessonForge · ENSIT hackathon</span></div>
        <h1>
          <Wave text={hero.lead} /> <em><Wave text={hero.em} /></em> <Wave text={hero.tail} />
        </h1>
        <p>{hero.body}</p>
        <div className="auth-pills">
          <span className="auth-pill">COMPRENDRE</span><span className="auth-pill">ENRICHIR</span><span className="auth-pill">AMÉLIORER</span>
        </div>
        <div className="game-chip no-canvas" aria-live="polite">
          <Icon name="link" size={15} />
          <span><strong>{links}</strong> {t("linksFound")}</span>
          <span className="muted">· {selected ? <>« {selected} » → ?</> : t("gameIntro")}</span>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => sky.current?.scatter()} title="Supernova">
            <Icon name="spark" size={14} />
          </button>
        </div>
        {toast && <div key={toast.id} className={`game-toast ${toast.ok ? "ok" : "no"}`}>{toast.text}</div>}
        <div className="auth-hint">{t("dragHint")} · {t("typeHint")} · double-clic = supernova</div>
      </section>
      <div>
        <div className="row between" style={{ marginBottom: "0.8rem" }}>
          <span />
          <LanguageSwitch compact />
        </div>
        <form className="auth-card stack" onSubmit={submit} aria-labelledby="auth-title">
          <div className="seg" role="group" aria-label="mode">
            <button type="button" aria-pressed={mode === "in"} onClick={() => setMode("in")}>{t("signIn")}</button>
            <button type="button" aria-pressed={mode === "up"} onClick={() => setMode("up")}>{t("signUp")}</button>
          </div>
          <h2 id="auth-title" className="sr-only">{mode === "in" ? t("signIn") : t("signUp")}</h2>
          {mode === "up" && (
            <div className="field">
              <label htmlFor="name">{t("displayName")}</label>
              <input id="name" type="text" required maxLength={80} value={name} onChange={(e) => { setName(e.target.value); launch(e); }} autoComplete="name" />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">{t("email")}</label>
            <input id="email" type="email" required value={email} onChange={(e) => { setEmail(e.target.value); launch(e); }} autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="pw">{t("password")}</label>
            <input id="pw" type="password" required minLength={mode === "up" ? 8 : 1} value={password} onChange={(e) => { setPassword(e.target.value); launch(e, true); }}
              autoComplete={mode === "in" ? "current-password" : "new-password"} />
          </div>
          {mode === "up" && (
            <>
              <label className="check"><input type="checkbox" checked={teacher} onChange={(e) => setTeacher(e.target.checked)} /> {t("iAmTeacher")}</label>
              {teacher && (
                <div className="field">
                  <label htmlFor="code">{t("teacherCode")}</label>
                  <input id="code" type="text" value={code} onChange={(e) => setCode(e.target.value)} />
                </div>
              )}
            </>
          )}
          {err != null && <ErrorBox error={err} />}
          <button className="btn btn-primary submit-glow" disabled={busy} type="submit" style={{ justifyContent: "center", padding: "0.65rem" }}>
            {busy ? <span className="spinner" /> : null} {mode === "in" ? t("signIn") : t("signUp")} <Icon name="arrow" size={15} />
          </button>
          <hr style={{ margin: "0.3rem 0" }} />
          <div className="stack" style={{ gap: "0.4rem" }}>
            <span className="tiny muted">{t("demoAccounts")} · <span className="kbd">demo-password-123</span> · local only</span>
            <div className="row" style={{ gap: "0.35rem" }}>
              {DEMO.map(([e, label]) => (
                <button key={e} type="button" className="chip" onClick={() => typeInto(e, "demo-password-123")}>{label}</button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
