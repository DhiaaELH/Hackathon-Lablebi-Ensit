import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { qk, useQueryClient } from "../api/hooks";
import type { Me } from "../api/types";
import { LanguageSwitch } from "../components/Layout";
import { ErrorBox } from "../components/ui";
import { useI18n } from "../i18n/I18n";

const DEMO = [
  ["student@demo.lessonforge.local", "Student"],
  ["senior@demo.lessonforge.local", "Senior / tutor"],
  ["teacher@demo.lessonforge.local", "Teacher"],
];

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
  const qc = useQueryClient();
  const nav = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const me =
        mode === "in"
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
    <div className="auth-wrap">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: "1rem" }}>
        <div className="brand"><span className="brand-mark" aria-hidden="true">L</span><span>LessonForge<small>{t("appTagline")}</small></span></div>
        <LanguageSwitch />
      </div>
      <form className="card stack" onSubmit={submit} aria-labelledby="auth-title">
        <h1 id="auth-title">{mode === "in" ? t("signIn") : t("signUp")}</h1>
        {mode === "up" && (
          <div className="field">
            <label htmlFor="name">{t("displayName")}</label>
            <input id="name" type="text" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
        )}
        <div className="field">
          <label htmlFor="email">{t("email")}</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="pw">{t("password")}</label>
          <input id="pw" type="password" required minLength={mode === "up" ? 8 : 1} value={password} onChange={(e) => setPassword(e.target.value)}
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
        <button className="btn btn-primary" disabled={busy} type="submit">{mode === "in" ? t("signIn") : t("signUp")}</button>
        <button type="button" className="btn btn-ghost" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? `${t("noAccount")} ${t("signUp")}` : `${t("haveAccount")} ${t("signIn")}`}
        </button>
      </form>
      <div className="card small">
        <strong>{t("demoAccounts")}</strong> <span className="muted">(local only · password: demo-password-123)</span>
        <div className="row" style={{ marginTop: 6 }}>
          {DEMO.map(([e, label]) => (
            <button key={e} type="button" className="btn btn-sm" onClick={() => { setMode("in"); setEmail(e); setPassword("demo-password-123"); }}>{label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
