import type { FeedPostData } from "../types";

const ZERO_REACTIONS = { like: 0, celebrate: 0, insightful: 0, support: 0 };

// Illustrative feed only — wire up to Supabase + real-time subscriptions later.
export const MOCK_POSTS: FeedPostData[] = [
  {
    id: "post-1", authorName: "Amina Al-Rashid", authorHeadline: "Senior Frontend Engineer · Accessibility Advocate", authorColor: "#6366f1",
    type: "careerPost", content: "Just shipped a fully keyboard-navigable data table for our dashboard — screen reader users can now sort, filter, and select rows without a mouse. Small wins like this add up! #accessibility #a11y",
    hashtags: ["accessibility", "a11y"], mentions: [],
    reactions: { like: 84, celebrate: 12, insightful: 21, support: 3 }, userReaction: null,
    comments: [{ id: "c1", authorName: "David Cohen", authorColor: "#10b981", text: "This is fantastic — sharing with my team.", date: "2026-07-01" }],
    bookmarked: false, shares: 6, date: "2026-07-01",
  },
  {
    id: "post-2", authorName: "Nova Systems", authorHeadline: "Technology · 1,200 employees", authorColor: "#6366f1",
    type: "companyUpdate", content: "We're proud to announce Nova Systems has been recognized as a top accessible employer for the second year running. Thank you to our incredible engineering and design teams. #hiring #accessibility",
    hashtags: ["hiring", "accessibility"], mentions: [],
    reactions: { like: 210, celebrate: 88, insightful: 14, support: 9 }, userReaction: "like",
    comments: [], bookmarked: false, shares: 34, date: "2026-06-30",
  },
  {
    id: "post-3", authorName: "Vertex AI Labs", authorHeadline: "Artificial Intelligence · 340 employees", authorColor: "#a855f7",
    type: "hiringPost", content: "We're hiring an AI Prompt Engineer to join our conversational AI team — fully remote, competitive salary. Tag someone who'd be a great fit! @AminaAlRashid #hiring #AI",
    hashtags: ["hiring", "AI"], mentions: ["AminaAlRashid"],
    reactions: { like: 62, celebrate: 5, insightful: 8, support: 2 }, userReaction: null,
    comments: [], bookmarked: true, shares: 11, date: "2026-06-29",
  },
  {
    id: "post-4", authorName: "Omar Khalil", authorHeadline: "Frontend Developer", authorColor: "#10b981",
    type: "poll", content: "Quick poll for frontend folks — what's slowing your team down the most right now?",
    pollOptions: [
      { id: "p1", label: "Design handoff friction", votes: 42 },
      { id: "p2", label: "Flaky CI/CD pipelines", votes: 28 },
      { id: "p3", label: "Legacy code debt", votes: 65 },
      { id: "p4", label: "Unclear requirements", votes: 19 },
    ],
    hashtags: [], mentions: [],
    reactions: { like: 31, celebrate: 0, insightful: 18, support: 1 }, userReaction: null,
    comments: [], bookmarked: false, shares: 4, date: "2026-06-28",
  },
  {
    id: "post-5", authorName: "Nadia Ferreira", authorHeadline: "AI / Prompt Engineer", authorColor: "#ec4899",
    type: "article", content:
      "Why Accessibility Should Be a First-Class Citizen in AI Products\n\n" +
      "As AI-powered interfaces become the default way people interact with software, the accessibility gap is widening rather than closing. Voice interfaces often assume perfect hearing and speech; generative UI components frequently skip semantic markup entirely; and screen readers struggle to keep up with dynamically streamed content. In this piece, I walk through five concrete patterns teams can adopt today: (1) always pair voice output with a text transcript, (2) use ARIA live regions responsibly for streaming AI responses, (3) never rely on color alone to indicate AI-generated vs. human content, (4) test with real assistive technology users early, and (5) build a11y acceptance criteria into every AI feature's definition of done. None of this is exotic — it's the same discipline that made the web accessible in the first place, just applied to a newer surface.",
    hashtags: ["accessibility", "AI"], mentions: [],
    reactions: { like: 145, celebrate: 9, insightful: 92, support: 6 }, userReaction: null,
    comments: [
      { id: "c2", authorName: "Ravi Shankar", authorColor: "#f97316", text: "Point 2 about ARIA live regions is so underrated. Great writeup.", date: "2026-06-27" },
    ],
    bookmarked: false, shares: 58, date: "2026-06-26",
  },
  {
    id: "post-6", authorName: "Clearview Design Studio", authorHeadline: "Design Agency · 40 employees", authorColor: "#ec4899",
    type: "image", content: "A peek at our latest accessible design system in progress — every component tested with NVDA and VoiceOver before it ships.",
    mediaLabel: "Design system preview", hashtags: ["design", "accessibility"], mentions: [],
    reactions: { like: 96, celebrate: 3, insightful: 20, support: 1 }, userReaction: null,
    comments: [], bookmarked: false, shares: 8, date: "2026-06-25",
  },
  {
    id: "post-7", authorName: "VisionEx Academy", authorHeadline: "Learning Platform", authorColor: "#14b8a6",
    type: "video", content: "New course drop: \"Building Accessible AI Interfaces\" — 6 hours, hands-on, taught by working accessibility engineers.",
    mediaLabel: "Course trailer (2:14)", hashtags: ["learning", "accessibility"], mentions: [],
    reactions: ZERO_REACTIONS, userReaction: null, comments: [], bookmarked: false, shares: 2, date: "2026-06-24",
  },
  {
    id: "post-8", authorName: "Atlas Finance Group", authorHeadline: "Finance · 800 employees", authorColor: "#0ea5e9",
    type: "document", content: "Our 2026 State of Fintech Hiring report is out — salary benchmarks, in-demand skills, and remote-work trends across the industry.",
    mediaLabel: "2026-fintech-hiring-report.pdf", hashtags: ["finance", "hiring"], mentions: [],
    reactions: { like: 40, celebrate: 1, insightful: 25, support: 0 }, userReaction: null,
    comments: [], bookmarked: false, shares: 15, date: "2026-06-23",
  },
];
