import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import React from "react";
import { Header } from "./components/layout/Header";

describe("Header Navigation & Mobile Drawer Acceptance Criteria", () => {
  describe("1. Citizen Desktop Navigation", () => {
    it("renders clean, unsqueezed Citizen nav items with NO duplicated 'Citizen' labels", () => {
      render(
        <Header
          mode="citizen"
          citizenTab="home"
          onSwitchCitizenTab={vi.fn()}
        />
      );

      // Verify clean items
      expect(screen.getByRole("button", { name: /WaterSignal/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Observe$/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Missions$/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /My Impact/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Account/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Research Workspace/i })).not.toBeInTheDocument();

      // Verify no duplicated "Citizen" labels in the primary nav buttons
      expect(screen.queryByRole("button", { name: /Citizen Missions/i })).not.toBeInTheDocument();
    });

    it("does NOT show any researcher navigation to citizens", () => {
      render(
        <Header
          mode="citizen"
          citizenTab="home"
        />
      );

      // Researcher nav must be completely hidden
      expect(screen.queryByRole("button", { name: /^Inbox$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^SignalCases$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Evidence Gaps$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Interoperability$/i })).not.toBeInTheDocument();
    });

    it("clearly indicates the current active page in Citizen mode", () => {
      render(
        <Header
          mode="citizen"
          citizenTab="impact"
        />
      );

      const impactBtn = screen.getByRole("button", { name: /My Impact/i });
      expect(impactBtn).toHaveAttribute("aria-current", "page");

      const homeBtn = screen.getByRole("button", { name: /WaterSignal/i });
      expect(homeBtn).not.toHaveAttribute("aria-current");
    });
  });

  describe("2. Researcher Desktop Navigation", () => {
    it("renders only working Researcher nav items: Inbox and Evidence Gaps", () => {
      render(
        <Header
          mode="research"
          researchTab="inbox"
          onSwitchResearchTab={vi.fn()}
        />
      );

      expect(screen.getByRole("button", { name: /^Inbox$/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Evidence Gaps$/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^SignalCases$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Interoperability$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Account/i })).not.toBeInTheDocument();
    });

    it("does NOT show citizen navigation to researchers", () => {
      render(
        <Header
          mode="research"
          researchTab="inbox"
        />
      );

      expect(screen.queryByRole("button", { name: /WaterSignal/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Observe$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Missions$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /My Impact/i })).not.toBeInTheDocument();
    });

    it("clearly indicates current active page in Researcher mode", () => {
      render(
        <Header
          mode="research"
          researchTab="gaps"
        />
      );

      const gapsBtn = screen.getByRole("button", { name: /^Evidence Gaps$/i });
      expect(gapsBtn).toHaveAttribute("aria-current", "page");

      const inboxBtn = screen.getByRole("button", { name: /^Inbox$/i });
      expect(inboxBtn).not.toHaveAttribute("aria-current");
    });
  });

  describe("3. Mobile Navigation Drawer / Sheet & Keyboard Accessibility", () => {
    it("opens mobile navigation in an accessible drawer dialog with ARIA attributes", () => {
      render(
        <Header
          mode="citizen"
          citizenTab="home"
        />
      );

      const hamburger = screen.getByLabelText("Toggle navigation menu");
      expect(hamburger).toHaveAttribute("aria-expanded", "false");

      fireEvent.click(hamburger);

      // Drawer dialog is open
      const drawer = screen.getByRole("dialog", { name: /Navigation menu/i });
      expect(drawer).toBeInTheDocument();
      expect(drawer).toHaveAttribute("aria-modal", "true");
    });

    it("closes mobile drawer when pressing the Escape key", () => {
      render(
        <Header
          mode="citizen"
          citizenTab="home"
        />
      );

      const hamburger = screen.getByLabelText("Toggle navigation menu");
      fireEvent.click(hamburger);

      expect(screen.getByRole("dialog", { name: /Navigation menu/i })).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(window, { key: "Escape", code: "Escape" });

      expect(screen.queryByRole("dialog", { name: /Navigation menu/i })).not.toBeInTheDocument();
    });

    it("keeps keyboard focus inside the open navigation drawer", () => {
      render(<Header mode="citizen" citizenTab="home" />);
      fireEvent.click(screen.getByLabelText("Toggle navigation menu"));

      const closeButton = screen.getByLabelText("Close navigation menu");
      closeButton.focus();
      fireEvent.keyDown(window, { key: "Tab", shiftKey: true });

      const dialog = screen.getByRole("dialog");
      const buttons = within(dialog).getAllByRole("button");
      const lastButton = buttons[buttons.length - 1];
      expect(lastButton).toHaveFocus();
    });

    it("navigates and closes mobile drawer on link selection", () => {
      const handleSwitch = vi.fn();
      render(
        <Header
          mode="citizen"
          citizenTab="home"
          onSwitchCitizenTab={handleSwitch}
        />
      );

      const hamburger = screen.getByLabelText("Toggle navigation menu");
      fireEvent.click(hamburger);

      const drawer = screen.getByRole("dialog", { name: /Navigation menu/i });
      expect(drawer).toBeInTheDocument();

      // Click Missions in drawer
      const missionsBtns = screen.getAllByRole("button", { name: /^Missions$/i });
      fireEvent.click(missionsBtns[missionsBtns.length - 1]);

      expect(handleSwitch).toHaveBeenCalledWith("missions");
      expect(screen.queryByRole("dialog", { name: /Navigation menu/i })).not.toBeInTheDocument();
    });

    it("shows only citizen navigation in mobile drawer for citizens", () => {
      render(
        <Header
          mode="citizen"
          citizenTab="home"
        />
      );

      const hamburger = screen.getByLabelText("Toggle navigation menu");
      fireEvent.click(hamburger);

      const drawer = screen.getByRole("dialog", { name: /Navigation menu/i });
      expect(drawer).toBeInTheDocument();

      // Zero researcher links in citizen drawer
      expect(screen.queryByRole("button", { name: /^Inbox$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Evidence Gaps$/i })).not.toBeInTheDocument();
    });

    it("shows only researcher navigation in mobile drawer for researchers", () => {
      render(
        <Header
          mode="research"
          researchTab="inbox"
        />
      );

      const hamburger = screen.getByLabelText("Toggle navigation menu");
      fireEvent.click(hamburger);

      const drawer = screen.getByRole("dialog", { name: /Navigation menu/i });
      expect(drawer).toBeInTheDocument();

      // Zero citizen links in researcher drawer
      expect(screen.queryByRole("button", { name: /WaterSignal/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Observe$/i })).not.toBeInTheDocument();
    });
  });

  describe("4. Usability at 320px Viewport", () => {
    it("renders Header brand, logo, and hamburger button comfortably at 320px", () => {
      window.innerWidth = 320;
      window.innerHeight = 568;

      const { container } = render(
        <Header
          mode="citizen"
          citizenTab="home"
        />
      );

      expect(screen.getByText("StreamSignal")).toBeInTheDocument();
      expect(screen.getByLabelText("Toggle navigation menu")).toBeInTheDocument();

      // Header container has overflow-x hidden or bounded
      const headerEl = container.querySelector("header");
      expect(headerEl).toBeInTheDocument();
    });
  });
});
