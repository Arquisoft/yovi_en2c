import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom";
import InstructionsContent from "../InstructionsContent";
import { I18nProvider } from "../i18n/I18nProvider";

function renderInstructionsContent(compact = false) {
  return render(
    <I18nProvider>
      <InstructionsContent compact={compact} />
    </I18nProvider>
  );
}

describe("InstructionsContent", () => {
  it("renders the three section headings", () => {
    renderInstructionsContent();

    expect(
      screen.getByRole("heading", { name: /Cómo se juega|How to play/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /^Dificultades$|^Difficulties$/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /Tamaño del tablero|Board size/i })
    ).toBeInTheDocument();
  });

  it("renders the how to play paragraphs", () => {
    renderInstructionsContent();

    expect(
      screen.getByText(
        /GameY es un juego por turnos|GameY is a turn-based game/i
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /El objetivo es conectar los lados del tablero|The objective is to connect the sides of the board/i
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Solo necesitas pulsar una celda vacía|You only need to click an empty cell/i
      )
    ).toBeInTheDocument();
  });

  it("renders the difficulty paragraphs", () => {
    renderInstructionsContent();

    expect(
      screen.getByText(
        /El juego dispone de varias dificultades|The game has several difficulty levels/i
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Puedes elegir la dificultad antes de comenzar la partida|You can choose the difficulty before starting the game/i
      )
    ).toBeInTheDocument();
  });

  it("renders the board size paragraphs", () => {
    renderInstructionsContent();

    expect(
      screen.getByText(
        /Puedes jugar en distintos tamaños de tablero|You can play on different board sizes/i
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Los tableros más grandes ofrecen partidas más largas y complejas|Larger boards offer longer and more complex matches/i
      )
    ).toBeInTheDocument();
  });

  it("renders exactly three sections", () => {
    const { container } = renderInstructionsContent();

    expect(container.querySelectorAll("section")).toHaveLength(3);
  });

  it("uses compact gap when compact is true", () => {
    const { container } = renderInstructionsContent(true);

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveStyle("gap: 16px");
  });

  it("uses normal gap when compact is false", () => {
    const { container } = renderInstructionsContent(false);

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveStyle("gap: 20px");
  });
});