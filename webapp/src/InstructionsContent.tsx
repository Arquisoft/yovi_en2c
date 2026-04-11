import React from "react";
import { useI18n } from "./i18n/I18nProvider";

type InstructionsContentProps = {
  compact?: boolean;
};

const InstructionsContent: React.FC<InstructionsContentProps> = ({ compact = false }) => {
  const { t } = useI18n();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: compact ? 16 : 20,
      }}
    >
      <section className="card">
        <h2 className="card__title">{t("instructions.howToPlay.title")}</h2>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            lineHeight: 1.6,
            textAlign: "left",
          }}
        >
          <p>{t("instructions.howToPlay.p1")}</p>
          <p>{t("instructions.howToPlay.p2")}</p>
          <p>{t("instructions.howToPlay.p3")}</p>
        </div>
      </section>

      <section className="card">
        <h2 className="card__title">{t("instructions.difficulty.title")}</h2>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            lineHeight: 1.6,
            textAlign: "left",
          }}
        >
          <p>{t("instructions.difficulty.p1")}</p>
          <p>{t("instructions.difficulty.p2")}</p>
        </div>
      </section>

      <section className="card">
        <h2 className="card__title">{t("instructions.board.title")}</h2>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            lineHeight: 1.6,
            textAlign: "left",
          }}
        >
          <p>{t("instructions.board.p1")}</p>
          <p>{t("instructions.board.p2")}</p>
        </div>
      </section>
    </div>
  );
};

export default InstructionsContent;