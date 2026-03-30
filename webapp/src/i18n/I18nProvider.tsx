// src/i18n/I18nProvider.tsx
import React, { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { translations } from "./translations";

type Lang = "en" | "es";

interface I18nContextValue {
  t: (key: string) => string;
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

interface I18nProviderProps {
  children: ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ children }) => {
  const [lang, setLang] = useState<Lang>("en");

  const t = (key: string) => {
    return translations[lang][key] ?? key;
  };

  return (
      <I18nContext.Provider value={{ t, lang, setLang }}>
        {children}
      </I18nContext.Provider>
  );
};

export const useI18n = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
};