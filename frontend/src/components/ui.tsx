import { useState, type ReactNode } from "react";
import type { RefT } from "../api/types";
import { useI18n } from "../i18n/I18n";
import type { MessageKey } from "../i18n/messages";
import { Icon } from "./Icon";
import { Rich } from "./Rich";

export function Spinner({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <span className="row muted" role="status">
      <span className="spinner" aria-hidden="true" /> {label ?? t("loading")}
    </span>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  const { t } = useI18n();
  const msg = error instanceof Error ? error.message : String(error ?? "");
  return (
    <div className="alert alert-error" role="alert">
      {t("error")}
      {msg ? `: ${msg}` : ""}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function QualityBadge({ status }: { status: string | null | undefined }) {
  const { t } = useI18n();
  if (!status) return null;
  const cls = status === "pass" ? "badge-success" : status === "revise" ? "badge-error" : "badge-warning";
  return <span className={`badge ${cls}`} title={t("qualityHint")}>{t(`quality_${status}` as MessageKey) ?? status}</span>;
}

/** Inline source citations ("p. 3") with an expandable excerpt from the student's own material.
 *  Refs that point at the same page are merged into one chip (its panel lists every excerpt); long lists collapse behind "+N". */
export function Citations({ refs, map, max = 4 }: { refs: string[]; map: Record<string, RefT> | undefined; max?: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  if (!refs?.length) return null;
  const groups: { label: string; refs: RefT[]; keys: string[] }[] = [];
  for (const r of refs) {
    const info = map?.[r];
    const label = info?.page ? `p.${info.page}` : r;
    const g = groups.find((x) => x.label === label);
    if (g) { if (!g.keys.includes(r)) { g.keys.push(r); if (info) g.refs.push(info); } }
    else groups.push({ label, refs: info ? [info] : [], keys: [r] });
  }
  const visible = all || groups.length <= max ? groups : groups.slice(0, max - 1);
  const shown = groups.find((g) => g.label === open);
  return (
    <span className="cites">
      {visible.map((g) => (
        <button key={g.label} type="button" className="cite" aria-expanded={open === g.label} onClick={() => setOpen(open === g.label ? null : g.label)}
          title={g.refs[0]?.section ?? g.keys[0]}>
          {g.label}
        </button>
      ))}
      {visible.length < groups.length && (
        <button type="button" className="cite cite-more" onClick={() => setAll(true)} aria-label={`${groups.length - visible.length} more`}>
          +{groups.length - visible.length}
        </button>
      )}
      {shown && (
        <span className="cite-panel small">
          {shown.refs.length === 0 && <span className="muted">{shown.label}</span>}
          {shown.refs.map((info) => (
            <span key={info.ref} className="cite-excerpt">
              <strong>{info.section ?? info.ref}</strong>{info.page ? ` · p.${info.page}` : ""}
              <Rich as="div" text={`${info.excerpt}…`} />
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="progress-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; icon?: string }[]; value: T; onChange: (v: T) => void }) {
  function onKey(e: React.KeyboardEvent, i: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const rtl = document.documentElement.dir === "rtl";
    const step = (e.key === "ArrowRight") !== rtl ? 1 : -1;
    const next = tabs[(i + step + tabs.length) % tabs.length];
    onChange(next.id);
    (e.currentTarget.parentElement?.children[(i + step + tabs.length) % tabs.length] as HTMLElement | undefined)?.focus();
  }
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tb, i) => (
        <button key={tb.id} role="tab" type="button" className="tab" aria-selected={value === tb.id} tabIndex={value === tb.id ? 0 : -1}
          onClick={() => onChange(tb.id)} onKeyDown={(e) => onKey(e, i)}>
          {tb.icon && <Icon name={tb.icon} size={16} />} {tb.label}
        </button>
      ))}
    </div>
  );
}

/** Only the two personas a student talks to are named. Background roles are labelled by their job (i18n `agent_<role>`). */
export const AGENT_INITIAL: Record<string, string> = { nova: "N", sam: "S" };
export const AGENT_NAME: Record<string, string> = { nova: "Nova", sam: "Sam" };
const AGENT_ICON: Record<string, string> = { clara: "search", alex: "wand", quinn: "question", riley: "shield", sage: "layers", max: "file", jordan: "compass", resource_finder: "link" };

export function useAgentLabel() {
  const { t } = useI18n();
  return (role: string) => AGENT_NAME[role] ?? t(`agent_${role}` as MessageKey) ?? role;
}

export function AgentAvatar({ role }: { role: string }) {
  return <span className="avatar" aria-hidden="true">{AGENT_INITIAL[role] ?? <Icon name={AGENT_ICON[role] ?? "spark"} size={15} />}</span>;
}
