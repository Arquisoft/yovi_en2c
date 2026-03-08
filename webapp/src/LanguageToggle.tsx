import React from "react";
import { useI18n } from "./i18n/I18nProvider";

type LanguageToggleProps = {
  className?: string;
};

const LanguageToggle: React.FC<LanguageToggleProps> = ({ className = "" }) => {
  const { lang, setLang, t } = useI18n();

  return (
    <div className={`lang-toggle ${className}`.trim()} role="group" aria-label={t("common.language")}>
      <button
        type="button"
        className={`lang-btn ${lang === "es" ? "is-active" : ""}`}
        onClick={() => setLang("es")}
        aria-pressed={lang === "es"}
      >
        ES
      </button>

      <button
        type="button"
        className={`lang-btn ${lang === "en" ? "is-active" : ""}`}
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
      >
        EN
      </button>
    </div>
  );
};

export default LanguageToggle;