import { ZoneAdminModule } from "./types";

export const ZONE_ADMIN_MODULES: ZoneAdminModule[] = [
  {
    id: "bookings_matchrooms",
    title: "Bookings & Matchrooms",
    description: "Requests, counter-offers, lifecycle, and payment state",
    route: "/zone/modules/bookings",
    icon: "event-note",
    tag: "Core",
  },
  {
    id: "resources",
    title: "Resources",
    description: "Per-branch seat and court allocation with live statuses",
    route: "/zone/modules/resources",
    icon: "grid-view",
  },
  {
    id: "pricing_promotions",
    title: "Pricing & Promotions",
    description: "Scheduled rules, discounts, and off-peak campaigns",
    route: "/zone/modules/pricing",
    icon: "sell",
  },
  {
    id: "support_safety",
    title: "Support & Safety",
    description: "Complaints, tickets, warnings, and bans",
    route: "/zone/modules/support",
    icon: "shield",
  },
  {
    id: "insights_security",
    title: "Insights & Security",
    description: "Operations KPIs, demand trends, and monitoring",
    route: "/zone/modules/insights",
    icon: "insights",
  },
  {
    id: "venue_settings",
    title: "Venue Settings",
    description: "Venue profile, operating hours, policies, and payouts",
    route: "/zone/modules/settings",
    icon: "settings",
    tag: "Setup",
  },
  {
    id: "notifications_center",
    title: "Notifications Center",
    description: "Realtime alerts, reminders, and targeted updates",
    route: "/zone/modules/notifications",
    icon: "notifications-active",
  },
  {
    id: "audit_security",
    title: "Audit & Security",
    description: "Action logs and suspicious activity flags",
    route: "/zone/modules/audit",
    icon: "fact-check",
  },
];

