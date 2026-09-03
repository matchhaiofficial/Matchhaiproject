// Phase 2 (team/profile) — skill tier badge rendering.
import React from "react";
import { render, screen } from "@testing-library/react-native";
import SkillBadge from "../../src/components/SkillBadge";

describe("SkillBadge", () => {
  it("renders the tier label uppercased with rating in parentheses", () => {
    render(<SkillBadge tier="Advanced" rating={82} />);
    expect(screen.getByText("ADVANCED")).toBeTruthy();
    expect(screen.getByText("(82)")).toBeTruthy();
  });

  it("hides the tier label in compact mode and shows the bare rating", () => {
    render(<SkillBadge tier="Pro" rating={95} size="compact" />);
    expect(screen.queryByText("PRO")).toBeNull();
    expect(screen.getByText("95")).toBeTruthy();
  });

  it("clamps the rating to 0..100", () => {
    render(<SkillBadge tier="Elite" rating={250} />);
    expect(screen.getByText("(100)")).toBeTruthy();
  });

  it("omits the rating when showRating is false", () => {
    render(<SkillBadge tier="Beginner" rating={10} showRating={false} />);
    expect(screen.getByText("BEGINNER")).toBeTruthy();
    expect(screen.queryByText("(10)")).toBeNull();
  });
});
