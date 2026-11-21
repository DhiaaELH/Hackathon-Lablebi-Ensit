import { useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { qk, useQueryClient } from "../api/hooks";
import type { Me } from "../api/types";
import { Constellation, type ConstellationHandle } from "../components/Constellation";
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
  fr: { lead: "Tes notes de cours,", em: "enfin", tail: "vivantes.", body: "Importe ton cours : LessonForge le structure, t'entraîne, t'explique en Derja ou en français, et aide ta classe à savoir où ça bloque — sans jamais exposer qui." },
  en: { lead: "Your course notes,", em: "finally", tail: "alive.", body: "Upload a course: LessonForge structures it, drills you, explains in Derja, French, English or Arabic, and helps your class see where it gets stuck — without ever exposing who." },
  ar: { lead: "ملاحظات درسك،", em: "أخيرًا", tail: "حيّة.", body: "ارفع درسك: ينظّمه LessonForge، ويدرّبك، ويشرح لك بالدارجة أو الفرنسية، ويساعد قسمك على معرفة مواضع الصعوبة — دون كشف أي هوية." },
  derja: { lead: "النوتات متاعك،", em: "أخيرًا", tail: "فيها الروح.", body: "حمّل الكور متاعك: LessonForge ينظّمو، يدرّبك، يفسّرلك بالدارجة ولا بالفرنسي، ويعاون القسم يعرف وين الصعوبة — بلاش ما يتعرف شكون." },
};

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
  const sky = useRef<ConstellationHandle>(null);
  const qc = useQueryClient();
  const nav = useNavigate();
  const hero = HERO[lang] ?? HERO.fr;
  const pulse = () => sky.current?.pulse();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const me = mode === "in"
        ? await api.post<Me>("/api/auth/login", { email, password })
        : await api.post<Me>("/api/auth/register", { email, password, display_name: name, locale: lang, role: teacher ? "teacher" : "student", teacher_code: teacher ? code : null });
      qc.setQueryData(qk.me, me);
      if (mode === "in" && me.locale) setLang(me.locale);
      nav("/");
    } catch (e2) {
      setErr(e2);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <Constellation ref={sky} />
      <section className="auth-hero" aria-label="LessonForge">
        <div className="row"><span className="brand-mark" aria-hidden="true">L</span><span className="eyebrow">LessonForge · ENSIT hackathon</span></div>
        <h1>{hero.lead} <em>{hero.em}</em> {hero.tail}</h1>
        <p>{hero.body}</p>
        <div className="auth-pills">
          <span className="auth-pill">COMPRENDRE</span><span className="auth-pill">ENRICHIR</span><span className="auth-pill">AMÉLIORER</span>
        </div>
        <div className="auth-hint">↖ move · click · type — the concepts react</div>
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
              <input id="name" type="text" required maxLength={80} value={name} onChange={(e) => { setName(e.target.value); pulse(); }} autoComplete="name" />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">{t("email")}</label>
            <input id="email" type="email" required value={email} onChange={(e) => { setEmail(e.target.value); pulse(); }} autoComplete="email" />
          </div>
          <div className="field">
            <label htmlFor="pw">{t("password")}</label>
            <input id="pw" type="password" required minLength={mode === "up" ? 8 : 1} value={password} onChange={(e) => { setPassword(e.target.value); pulse(); }}
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
          <button className="btn btn-primary" disabled={busy} type="submit" style={{ justifyContent: "center", padding: "0.65rem" }}>
            {busy ? <span className="spinner" /> : null} {mode === "in" ? t("signIn") : t("signUp")}
          </button>
          <hr style={{ margin: "0.3rem 0" }} />
          <div className="stack" style={{ gap: "0.4rem" }}>
            <span className="tiny muted">{t("demoAccounts")} · <span className="kbd">demo-password-123</span> · local only</span>
            <div className="row" style={{ gap: "0.35rem" }}>
              {DEMO.map(([e, label]) => (
                <button key={e} type="button" className="chip" onClick={() => { setMode("in"); setEmail(e); setPassword("demo-password-123"); pulse(); pulse(); }}>{label}</button>
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
