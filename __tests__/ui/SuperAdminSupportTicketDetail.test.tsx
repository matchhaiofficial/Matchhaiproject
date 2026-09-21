import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react-native";

const mockGetSupportTicketById = jest.fn();
const mockSubscribeSupportTicketById = jest.fn();

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "ticket_1" }),
  useRouter: () => ({ back: jest.fn() }),
}));

jest.mock("../../src/components/AppHeader", () => () => null);
jest.mock("../../src/components/Screen", () => {
  const ReactModule = require("react");
  const { View } = require("react-native");
  return ({ children }: { children: any }) => ReactModule.createElement(View, null, children);
});
jest.mock("../../src/components/AdminSurface", () => {
  const ReactModule = require("react");
  const { Text } = require("react-native");
  return {
    AdminInfoLine: ({ label, value }: { label: string; value: string }) => (
      ReactModule.createElement(Text, null, `${label}: ${value}`)
    ),
  };
});
jest.mock("../../src/hooks/useToast", () => ({
  useToast: () => ({ showToast: jest.fn() }),
}));
jest.mock("../../src/services/convex/superAdminService", () => ({
  addSupportTicketInternalNote: jest.fn(),
  assignSupportTicket: jest.fn(),
  getSupportTicketById: (...args: unknown[]) => mockGetSupportTicketById(...args),
  processAccountDeletion: jest.fn(),
  replyToSupportTicketUser: jest.fn(),
  resolveSupportTicket: jest.fn(),
  subscribeSupportTicketById: (...args: unknown[]) => mockSubscribeSupportTicketById(...args),
  updateSupportTicketStatus: jest.fn(),
}));

import SuperAdminSupportTicketDetail from "../../app/super-admin/support-ticket/[id]";

describe("SuperAdminSupportTicketDetail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps a subscription result visible when the concurrent initial request fails", async () => {
    let resolveRequest!: (value: { ok: false; message: string }) => void;
    mockGetSupportTicketById.mockReturnValue(new Promise((resolve) => {
      resolveRequest = resolve;
    }));
    mockSubscribeSupportTicketById.mockImplementation((_id, onData) => {
      onData({
        id: "ticket_1",
        reference: "MH-1001",
        issueSummary: "Account question",
        status: "open",
        userDisplayName: "QA Player",
        userRole: "player",
        category: "general",
        source: "app",
        createdAt: 1,
        updatedAt: 1,
      });
      return jest.fn();
    });

    render(<SuperAdminSupportTicketDetail />);
    await waitFor(() => expect(screen.getByText("MH-1001")).toBeTruthy());

    await act(async () => {
      resolveRequest({ ok: false, message: "Network unavailable." });
      await Promise.resolve();
    });

    expect(screen.getByText("MH-1001")).toBeTruthy();
    expect(screen.getByText(/Network unavailable\. Saved ticket data remains visible/)).toBeTruthy();
  });
});
