import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, test, expect } from "vitest";
import "@testing-library/jest-dom";
import LanguageToggle from "../LanguageToggle";
import { I18nProvider } from "../i18n/I18nProvider";

function renderWithProvider() {
  return render(
    <I18nProvider>
      <LanguageToggle />
    </I18nProvider>
  );
}

describe("LanguageToggle", () => {
  test("renders language buttons", () => {
    renderWithProvider();

    expect(screen.getByRole("button", { name: "ES" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "EN" })).toBeInTheDocument();
  });

  test("ES is active by default", () => {
    renderWithProvider();

    const esButton = screen.getByRole("button", { name: "ES" });
    const enButton = screen.getByRole("button", { name: "EN" });

    expect(esButton).toHaveAttribute("aria-pressed", "true");
    expect(enButton).toHaveAttribute("aria-pressed", "false");
  });

  test("switches language when clicking EN", async () => {
    const user = userEvent.setup();

    renderWithProvider();

    const esButton = screen.getByRole("button", { name: "ES" });
    const enButton = screen.getByRole("button", { name: "EN" });

    await user.click(enButton);

    expect(enButton).toHaveAttribute("aria-pressed", "true");
    expect(esButton).toHaveAttribute("aria-pressed", "false");
  });

  test("switches back to ES when clicking ES", async () => {
    const user = userEvent.setup();

    renderWithProvider();

    const esButton = screen.getByRole("button", { name: "ES" });
    const enButton = screen.getByRole("button", { name: "EN" });

    await user.click(enButton);
    await user.click(esButton);

    expect(esButton).toHaveAttribute("aria-pressed", "true");
    expect(enButton).toHaveAttribute("aria-pressed", "false");
  });
});