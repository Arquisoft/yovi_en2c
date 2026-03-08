import React, { createContext, useContext, useMemo, useState } from "react";
import { translations } from "./translations";
import type { Lang } from "./translations";

type I18nCtx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nCtx | null>(null);

function format(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem("lang");
    return (saved === "es" || saved === "en") ? saved : "es";
  });

  const setLang = (l: Lang) => {
    localStorage.setItem("lang", l);
    setLangState(l);
  };

  const t = useMemo(() => {
    return (key: string, vars?: Record<string, string | number>) => {
      const dict = translations[lang];
      const raw = dict[key] ?? translations.es[key] ?? key;
      return format(raw, vars);
    };
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}