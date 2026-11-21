import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Lang } from "../api/types";
import { MESSAGES, isRtl, type MessageKey } from "./messages";

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: MessageKey) => string;
  tf: (k: MessageKey, args: Record<string, string | number>) => string;
  dir: "rtl" | "ltr";
}

const Ctx = createContext<I18nCtx | null>(null);
const STORAGE_KEY = "lf.lang";

function initialLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "fr" || v === "en" || v === "ar" || v === "derja") return v;
  } catch {
    /* storage unavailable */
  }
  return "fr";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const dir = isRtl(lang) ? "rtl" : "ltr";
  useEffect(() => {
    document.documentElement.lang = lang === "derja" ? "aeb" : lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);
  const value = useMemo<I18nCtx>(
    () => ({
      lang,
      dir,
      setLang: (l) => {
        setLangState(l);
        try {
          localStorage.setItem(STORAGE_KEY, l);
        } catch {
          /* ignore */
        }
      },
      t: (k) => MESSAGES[lang][k] ?? MESSAGES.fr[k] ?? k,
      tf: (k, args) => (MESSAGES[lang][k] ?? MESSAGES.fr[k] ?? k).replace(/\{(\w+)\}/g, (_, n: string) => String(args[n] ?? "")),
    }),
    [lang, dir],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n outside provider");
  return v;
}
