import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { qk, useMe, useQueryClient } from "../api/hooks";
import type { Lang, Me } from "../api/types";
import { Spinner } from "../components/ui";
import { useI18n } from "../i18n/I18n";
import { LANG_LABEL } from "../i18n/messages";

export function Settings() {
  const { t, setLang } = useI18n();
  const me = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [saved, setSaved] = useState(false);
  if (!me.data) return <Spinner />;
  const m = me.data;

  async function patch(body: Partial<Me>) {
    const r = await api.patch<Me>("/api/auth/me", body);
    qc.setQueryData(qk.me, r);
    if (body.locale) setLang(body.locale);
    setSaved(true);
  }
  async function exportData() {
    const data = await api.get<unknown>("/api/auth/me/export");
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "lessonforge-export.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  async function del() {
    if (!confirm(t("deleteConfirm"))) return;
    await api.del("/api/auth/me");
    qc.clear();
    nav("/login");
  }
  return (
    <div className="stack" style={{ maxWidth: 640 }}>
      <h1>{t("settings")}</h1>
      <div className="card stack">
        <div className="field">
          <label htmlFor="loc">{t("language")}</label>
          <select id="loc" value={m.locale} onChange={(e) => patch({ locale: e.target.value as Lang })}>
            {(Object.keys(LANG_LABEL) as Lang[]).map((l) => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="script">{t("derjaScript")}</label>
          <select id="script" value={m.derja_script} onChange={(e) => patch({ derja_script: e.target.value as "arabic" | "latin" })}>
            <option value="arabic">{t("arabicScript")}</option>
            <option value="latin">{t("latinScript")}</option>
          </select>
          <span className="small muted">{t("derjaNote")}</span>
        </div>
        <label className="check"><input type="checkbox" checked={m.searchable} onChange={(e) => patch({ searchable: e.target.checked })} /> Searchable profile (username / display name only)</label>
        {saved && <div className="alert alert-success small">✓ {t("saved")}</div>}
      </div>
      <div className="card row">
        <button className="btn" onClick={exportData}>{t("exportData")}</button>
        <button className="btn btn-danger" onClick={del}>{t("deleteAccount")}</button>
      </div>
    </div>
  );
}
