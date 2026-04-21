import React from "react";
import { useTheme } from "./ThemeProvider";
import { useI18n } from "./i18n/I18nProvider";

type ThemeToggleProps = {
  className?: string;
};

const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = "" }) => {
  const { theme, toggleTheme } = useTheme();
  const { t } = useI18n();

  const isDark = theme === "dark";
  const label = isDark ? t("common.lightMode") : t("common.darkMode");

  return (
    <button
      type="button"
      className={`navbtn theme-toggle ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
};

export default ThemeToggle;
