import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { qk, useLlmCost, useMe, useQueryClient } from "../api/hooks";
import type { Lang, LlmCost, Me } from "../api/types";
import { Icon } from "../components/Icon";
import { useToast } from "../components/Toast";
import { Spinner } from "../components/ui";
import { useI18n } from "../i18n/I18n";
import { LANG_LABEL } from "../i18n/messages";

export function Settings() {
  const { t, setLang } = useI18n();
  const me = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
  if (!me.data) return <Spinner />;
  const m = me.data;

  async function patch(body: Partial<Me> & { interests?: string[] }) {
    const r = await api.patch<Me>("/api/auth/me", body);
    qc.setQueryData(qk.me, r);
    if (body.locale) setLang(body.locale);
    qc.invalidateQueries({ queryKey: qk.recs });
    toast(t("toastSaved"));
  }
  async function exportData() {
    const data = await api.get<unknown>("/api/auth/me/export");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = "lessonforge-export.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  async function del() {
    if (!confirm(t("deleteConfirm"))) return;
    await api.del("/api/auth/me");
    qc.clear();
    nav("/login");
  }
  return (
    <div className="stack" style={{ maxWidth: 680, gap: "1rem" }}>
      <header className="page-head"><h1>{t("settings")}</h1></header>
      <section className="card stack">
        <h2>{t("language")}</h2>
        <div className="grid grid-2">
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
          </div>
        </div>
        <span className="tiny muted">{t("derjaNote")}</span>
      </section>
      <section className="card stack">
        <h2>{t("people")}</h2>
        <div className="field">
          <label htmlFor="bio">{t("bio")}</label>
          <input id="bio" type="text" maxLength={300} defaultValue={m.bio ?? ""} onBlur={(e) => e.target.value !== (m.bio ?? "") && patch({ bio: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="interests">{t("forYou")} — interests (comma-separated)</label>
          <input id="interests" type="text" defaultValue={m.interests.join(", ")}
            onBlur={(e) => patch({ interests: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
        </div>
        <label className="check"><input type="checkbox" checked={m.searchable} onChange={(e) => patch({ searchable: e.target.checked })} /> {t("searchable")}</label>
        <label className="check"><input type="checkbox" checked={m.show_follows} onChange={(e) => patch({ show_follows: e.target.checked })} /> {t("showFollows")}</label>
        <div className="field" style={{ maxWidth: 320 }}>
          <label htmlFor="msg">{t("whoCanMessage")}</label>
          <select id="msg" value={m.message_setting} onChange={(e) => patch({ message_setting: e.target.value })}>
            <option value="everyone">{t("everyone")}</option>
            <option value="followers">{t("followersOnly")}</option>
            <option value="nobody">{t("nobody")}</option>
          </select>
        </div>
      </section>
      {m.role === "admin" && <ApiCost />}
      <section className="card row">
        <button className="btn" onClick={exportData}><Icon name="download" size={15} /> {t("exportData")}</button>
        <button className="btn btn-danger" onClick={del}>{t("deleteAccount")}</button>
      </section>
    </div>
  );
}

const usd = (v: number) => `$${v < 1 ? v.toFixed(v === 0 ? 2 : 3) : v.toFixed(2)}`;
const tok = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)} M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)} k` : String(n));

/** Admin only: estimated AI API spend from logged token counts (GET /api/system/llm-cost). */
function ApiCost() {
  const { t, lang } = useI18n();
  const q = useLlmCost(true);
  const d: LlmCost | undefined = q.data;
  const locale = lang === "en" ? "en-GB" : lang === "fr" ? "fr-FR" : "ar-TN";
  return (
    <section className="card stack">
      <h2>{t("apiCost")}</h2>
      {q.isLoading && <Spinner />}
      {q.isError && <div className="alert alert-error">{String((q.error as Error)?.message ?? q.error)}</div>}
      {d && (
        <>
          <p className="small muted" style={{ margin: 0 }}>{t("apiCostIntro").replace("{date}", d.prices_as_of)}</p>
          {d.calls === 0 ? <div className="empty">{t("costEmpty")}</div> : (
            <>
              <div className="stat-grid">
                <div className="stat"><strong>{usd(d.totals.today)}</strong><span className="small muted">{t("costToday")}</span></div>
                <div className="stat"><strong>{usd(d.totals.month)}</strong><span className="small muted">{t("costMonth")}</span></div>
                <div className="stat"><strong>{usd(d.totals.last_30d)}</strong><span className="small muted">{t("cost30d")}</span></div>
                <div className="stat"><strong>{usd(d.totals.all)}</strong><span className="small muted">{t("costAll")}</span></div>
              </div>
              {d.since && <span className="small muted">{t("costCalls").replace("{n}", String(d.calls)).replace("{date}", new Date(d.since).toLocaleDateString(locale))}</span>}
              <div className="table-wrap">
                <table>
                  <thead><tr><th>{t("costModel")}</th><th>{t("costCallsCol")}</th><th>{t("costIn")}</th><th>{t("costOut")}</th><th>{t("costCached")}</th><th>{t("costCol")}</th></tr></thead>
                  <tbody>
                    {d.by_model.map((r) => (
                      <tr key={r.model}>
                        <td><strong>{r.model}</strong>
                          {r.price && <div className="tiny muted">{r.price.input} · {r.price.output} {t("costPerM")}</div>}</td>
                        <td>{r.calls}</td><td>{tok(r.input_tokens)}</td><td>{tok(r.output_tokens)}</td><td>{tok(r.cache_read_tokens + r.cache_write_tokens)}</td>
                        <td><strong>{r.cost_usd === null ? "—" : usd(r.cost_usd)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {d.unpriced_models.length > 0 && <div className="alert alert-warning">{t("costUnpriced").replace("{models}", d.unpriced_models.join(", "))}</div>}
            </>
          )}
        </>
      )}
    </section>
  );
}
