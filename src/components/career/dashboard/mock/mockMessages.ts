import type { DashboardMessage } from "../types";

export const MOCK_MESSAGES: DashboardMessage[] = [
  {
    id: "msg-1", senderName: "Nova Systems — Talent Team", senderColor: "#6366f1",
    subject: "Interview scheduled for Senior Frontend Engineer",
    preview: "Hi Amina, we're excited to move forward with your application...",
    body: "Hi Amina,\n\nWe're excited to move forward with your application for the Senior Frontend Engineer role. We'd like to schedule a video interview for next week — please let us know your availability.\n\nBest,\nNova Systems Talent Team",
    date: "2026-07-01", read: false, starred: true,
  },
  {
    id: "msg-2", senderName: "Vertex AI Labs", senderColor: "#a855f7",
    subject: "Thank you for applying",
    preview: "Thanks for your interest in the AI Prompt Engineer position...",
    body: "Thanks for your interest in the AI Prompt Engineer position. Our team is reviewing applications and will follow up within two weeks.",
    date: "2026-06-26", read: false, starred: false,
  },
  {
    id: "msg-3", senderName: "Atlas Finance Group", senderColor: "#0ea5e9",
    subject: "Offer letter attached",
    preview: "Congratulations! We're pleased to offer you the position...",
    body: "Congratulations! We're pleased to offer you the Frontend Developer position at Atlas Finance Group. Please find the offer details attached.",
    date: "2026-06-18", read: true, starred: true,
  },
  {
    id: "msg-4", senderName: "VisionEx Career Center", senderColor: "#14b8a6",
    subject: "Your weekly job digest is ready",
    preview: "12 new jobs match your saved search criteria this week...",
    body: "12 new jobs match your saved search criteria this week. Check your Recommended Jobs tab for the full list.",
    date: "2026-06-15", read: true, starred: false,
  },
];
