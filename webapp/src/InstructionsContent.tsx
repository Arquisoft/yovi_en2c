import React from "react";
import { useI18n } from "./i18n/I18nProvider";

type InstructionsContentProps = {
  compact?: boolean;
};

const InstructionsContent: React.FC<InstructionsContentProps> = ({ compact = false }) => {
  const { t } = useI18n();

  const sections = [
    {
      title: t("instructions.howToPlay.title"),
      paragraphs: [
        t("instructions.howToPlay.p1"),
        t("instructions.howToPlay.p2"),
        t("instructions.howToPlay.p3"),
      ],
    },
    {
      title: t("instructions.difficulty.title"),
      paragraphs: [
        t("instructions.difficulty.p1"),
        t("instructions.difficulty.p2"),
      ],
    },
    {
      title: t("instructions.board.title"),
      paragraphs: [
        t("instructions.board.p1"),
        t("instructions.board.p2"),
      ],
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: compact ? 16 : 20,
      }}
    >
      {sections.map((section) => (
        <section key={section.title} className="card">
          <h2 className="card__title">{section.title}</h2>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              lineHeight: 1.6,
              textAlign: "left",
            }}
          >
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default InstructionsContent;