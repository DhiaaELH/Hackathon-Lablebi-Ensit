import { useState, type ReactNode } from "react";
import type { RefT } from "../api/types";
import { useI18n } from "../i18n/I18n";
import type { MessageKey } from "../i18n/messages";

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
  return <span className={`badge ${cls}`} title="Riley">{t(`quality_${status}` as MessageKey) ?? status}</span>;
}

/** Inline source citations ("p. 3") with an expandable excerpt from the student's own material. */
export function Citations({ refs, map }: { refs: string[]; map: Record<string, RefT> | undefined }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!refs?.length) return null;
  const shown = open && map?.[open];
  return (
    <span>
      {refs.map((r) => {
        const info = map?.[r];
        const label = info?.page ? `p.${info.page}` : r;
        return (
          <button key={r} type="button" className="cite" aria-expanded={open === r} onClick={() => setOpen(open === r ? null : r)}
            title={info?.section ?? r}>
            {label}
          </button>
        );
      })}
      {shown && (
        <span className="alert small" style={{ display: "block", marginTop: 6 }}>
          <strong>{shown.section ?? shown.ref}</strong>
          {shown.page ? ` · p.${shown.page}` : ""}
          <br />
          {shown.excerpt}…
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

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((tb) => (
        <button key={tb.id} role="tab" type="button" className="tab" aria-selected={value === tb.id} onClick={() => onChange(tb.id)}>
          {tb.label}
        </button>
      ))}
    </div>
  );
}

export const AGENT_INITIAL: Record<string, string> = {
  nova: "N", sam: "S", clara: "C", alex: "A", quinn: "Q", riley: "R", sage: "Sg", max: "M", jordan: "J", resource_finder: "RF",
};
export const AGENT_NAME: Record<string, string> = {
  nova: "Nova", sam: "Sam", clara: "Clara", alex: "Alex", quinn: "Quinn", riley: "Riley", sage: "Sage", max: "Max", jordan: "Jordan", resource_finder: "Resource Finder",
};
