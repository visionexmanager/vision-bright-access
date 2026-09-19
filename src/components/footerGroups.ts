// The footer's sitemap, each link under the group it belongs to — the same
// groups the navigation uses, so a page is always found under the same name.
//
// Kept apart from Layout.tsx because a component file that also exports data
// breaks React fast refresh, and because a test reads these groups directly.
// The two old columns were "Pages" and "More", which put the Academy beside the
// leaderboard and the news beside the finance hub.

export const FOOTER_GROUPS = [
  {
    id: "platform",
    headingKey: "footer.platform",
    links: [
      { to: "/", labelKey: "footer.link.home" },
      { to: "/bazaar", labelKey: "footer.link.bazaar" },
      { to: "/services", labelKey: "footer.link.services" },
      { to: "/services/ai-media-studio", labelKey: "footer.link.aiStudio" },
      { to: "/services/file-studio", labelKey: "footer.link.fileConverter" },
      { to: "/assistive-products", labelKey: "footer.link.assistiveProducts" },
    ],
  },
  {
    id: "learning",
    headingKey: "nav.group.learning",
    links: [
      { to: "/academy", labelKey: "footer.link.academy" },
      { to: "/library", labelKey: "footer.link.library" },
      { to: "/kids", labelKey: "nav.kids" },
    ],
  },
  {
    id: "work",
    headingKey: "nav.group.work",
    links: [
      { to: "/careers", labelKey: "career.title" },
      { to: "/finance", labelKey: "footer.link.finance" },
      { to: "/professional-tools", labelKey: "footer.link.professionalTools" },
    ],
  },
  {
    id: "media",
    headingKey: "nav.group.media",
    links: [
      { to: "/news", labelKey: "footer.link.news" },
      { to: "/content", labelKey: "footer.link.content" },
      { to: "/games", labelKey: "footer.link.games" },
    ],
  },
  {
    id: "community",
    headingKey: "nav.group.community",
    links: [
      { to: "/community", labelKey: "footer.link.community" },
      { to: "/leaderboard", labelKey: "footer.link.leaderboard" },
      { to: "/contact-us", labelKey: "footer.link.contact" },
      { to: "/pricing", labelKey: "plans.title" },
    ],
  },
] as const;
