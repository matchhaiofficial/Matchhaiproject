// Phase 2 (4) — MatchroomCard: status labels (full/locked/expired/completed),
// seats remaining, date/time, price, request/joined actions, and NO match code/QR.
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import MatchroomCard from "../../app/matchrooms/components/MatchroomCard";

const FUTURE = "2026-12-10";
const PAST = "2020-01-01";

function makeCardRoom(overrides: Record<string, any> = {}): any {
  return {
    id: "room_1",
    matchCode: "MH-SECRET-CODE",
    game: "Valorant",
    title: "Evening Scrims",
    status: "open",
    scheduledDate: FUTURE,
    scheduledTime: "18:00",
    durationMinutes: 60,
    slotsA: [
      { slotId: "a1", status: "confirmed", uid: "u1" },
      { slotId: "a2", status: "open" },
    ],
    slotsB: [{ slotId: "b1", status: "open" }],
    maxPlayers: 10,
    currentPlayers: 1,
    friendJoinedCount: 0,
    pricing: { perPlayer: 250 },
    format: "5v5",
    ...overrides,
  };
}

describe("MatchroomCard", () => {
  it("renders game, title, price and seats-remaining", () => {
    render(<MatchroomCard room={makeCardRoom()} />);
    expect(screen.getByText("Valorant")).toBeTruthy();
    expect(screen.getByText("Evening Scrims")).toBeTruthy();
    expect(screen.getByText("Rs. 250")).toBeTruthy();
    expect(screen.getByText("2 seats remaining")).toBeTruthy();
  });

  it("shows FREE when there is no per-player price", () => {
    render(<MatchroomCard room={makeCardRoom({ pricing: { perPlayer: 0 } })} />);
    expect(screen.getByText("FREE")).toBeTruthy();
  });

  it("never displays the raw match code / QR value", () => {
    render(<MatchroomCard room={makeCardRoom()} />);
    expect(screen.queryByText(/MH-SECRET-CODE/)).toBeNull();
  });

  it("shows a COMPLETED badge for completed rooms and hides the Request button", () => {
    const onJoinPress = jest.fn();
    render(<MatchroomCard room={makeCardRoom({ status: "completed" })} onJoinPress={onJoinPress} />);
    expect(screen.getByText("COMPLETED")).toBeTruthy();
    expect(screen.queryByText("Request")).toBeNull();
  });

  it("shows a FULL badge when every slot is confirmed", () => {
    const full = makeCardRoom({
      maxPlayers: 2,
      currentPlayers: 2,
      slotsA: [{ slotId: "a1", status: "confirmed", uid: "u1" }],
      slotsB: [{ slotId: "b1", status: "confirmed", uid: "u2" }],
    });
    render(<MatchroomCard room={full} />);
    expect(screen.getByText("FULL")).toBeTruthy();
  });

  it("hides the Request button when the room is full", () => {
    const full = makeCardRoom({
      maxPlayers: 2,
      currentPlayers: 2,
      slotsA: [{ slotId: "a1", status: "confirmed", uid: "u1" }],
      slotsB: [{ slotId: "b1", status: "confirmed", uid: "u2" }],
    });
    render(<MatchroomCard room={full} onJoinPress={jest.fn()} />);
    expect(screen.queryByText("Request")).toBeNull();
  });

  it("hides the Request button when the room is locked", () => {
    render(<MatchroomCard room={makeCardRoom({ status: "locked" })} onJoinPress={jest.fn()} />);
    expect(screen.getByText("LOCKED")).toBeTruthy();
    expect(screen.queryByText("Request")).toBeNull();
  });

  it("shows an EXPIRED badge for an unfilled room past its schedule", () => {
    render(<MatchroomCard room={makeCardRoom({ scheduledDate: PAST, scheduledTime: "10:00" })} />);
    expect(screen.getByText("EXPIRED")).toBeTruthy();
  });

  it("renders a Request button for an open room and fires onJoinPress", () => {
    const onJoinPress = jest.fn();
    render(<MatchroomCard room={makeCardRoom()} onJoinPress={onJoinPress} />);
    const btn = screen.getByText("Request");
    // The card calls e.stopPropagation(), so supply a synthetic event.
    fireEvent.press(btn, { stopPropagation: jest.fn() });
    expect(onJoinPress).toHaveBeenCalled();
  });

  it("shows a Joined badge when isJoined is set", () => {
    render(<MatchroomCard room={makeCardRoom()} isJoined onJoinPress={jest.fn()} />);
    expect(screen.getByText("Joined")).toBeTruthy();
    expect(screen.queryByText("Request")).toBeNull();
  });

  it("shows the pending request label when isRequested", () => {
    render(
      <MatchroomCard
        room={makeCardRoom()}
        isRequested
        requestLabel="Pending"
        onCancelJoinPress={jest.fn()}
      />,
    );
    expect(screen.getByText("Pending")).toBeTruthy();
  });
});
