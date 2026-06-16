import fs from "node:fs";
import path from "node:path";

const i18nDir = path.join(process.cwd(), "src", "i18n");
const targets = {
  ar: "ar",
  es: "es",
  de: "de",
  pt: "pt",
  zh: "zh-CN",
  tr: "tr",
  fr: "fr",
  ru: "ru",
  ur: "ur",
  hi: "hi",
};

const englishAdds = {
  "mp.done": "Done!",
  "mp.doneCheck": "Done",
  "mp.yourTurn": "Your turn",
  "mp.yourTurnPlay": "Your turn - play a card",
  "mp.yourTurnCards": "Your turn - {count} card(s)",
  "mp.opponentTurn": "Opponent's turn",
  "mp.opponentTurnDots": "Opponent's turn...",
  "mp.playing": "Playing",
  "mp.waitingDots": "Waiting...",
  "mp.cardPlayedWaiting": "Card played. Waiting...",
  "mp.playCard": "Play card",
  "mp.sameWord": "Same word",
  "mp.youWereBreached": "You were breached",
  "mp.scoreWaiting": "Score waiting",
  "mp.yourScore": "Your score",
  "mp.opponentCards": "Opponent cards",
  "mp.mistakes": "Mistakes",
  "ai.service.ask": "Ask {assistant}",
  "ai.service.intro": "An AI advisor specialized in {title}. Ask anything and get an instant answer.",
  "ai.service.placeholder": "Type your question...",
  "ai.service.disclaimer": "AI answers are guidance only and may contain mistakes.",
  "ai.service.voice": "Voice chat",
  "ai.task.placeholder": "Ask for tailored help...",
  "ai.task.failed": "AI assistant could not run",
  "ai.task.copied": "Result copied",
  "ai.task.analyzing": "Analyzing...",
  "ai.task.copy": "Copy",
  "ai.task.useResult": "Use result",
  "ai.task.stop": "Stop",
  "ai.task.send": "Send",
  "ai.smartSearch.placeholder": "Search by meaning...",
  "ai.smartSearch.noResults": "No results",
  "ai.image.choose": "Choose photo",
  "ai.image.analyze": "Analyze photo",
  "ai.image.analyzing": "Analyzing...",
  "ai.image.summary": "Summary",
  "ai.image.findings": "Findings",
  "ai.image.recommendations": "Recommendations",
  "ai.image.tooLarge": "Image is too large (8 MB max).",
  "ai.image.failed": "Could not analyze the image. Please try again.",
  "ai.plan.generate": "Generate",
  "ai.plan.generating": "Generating...",
  "ai.plan.tips": "Tips",
  "ai.plan.fillRequired": "Please fill in the required fields.",
  "ai.plan.failed": "Could not generate. Please try again.",

  // Capability source strings used through translateText().
  "ai.cap.skinHint": "Upload a clear, well-lit photo of your face/skin for a personalized assessment.",
  "ai.cap.hairHint": "Upload a clear photo of your hair and scalp for a personalized assessment.",
  "ai.cap.trainingTitle": "Generate a Weekly Training Plan",
  "ai.cap.travelTitle": "Generate a Travel Itinerary",
  "ai.cap.goal": "Goal",
  "ai.cap.level": "Level",
  "ai.cap.daysPerWeek": "Days per week",
  "ai.cap.equipment": "Equipment",
  "ai.cap.notes": "Notes (optional)",
  "ai.cap.destination": "Destination",
  "ai.cap.days": "Days",
  "ai.cap.budget": "Budget",
  "ai.cap.interests": "Interests",
  "ai.cap.accessibilityNeeds": "Accessibility needs (optional)",
  "ai.cap.weightLoss": "Weight loss",
  "ai.cap.muscleGain": "Muscle gain",
  "ai.cap.endurance": "Endurance",
  "ai.cap.generalFitness": "General fitness",
  "ai.cap.beginner": "Beginner",
  "ai.cap.intermediate": "Intermediate",
  "ai.cap.advanced": "Advanced",
  "ai.cap.bodyweightOnly": "Bodyweight only",
  "ai.cap.dumbbells": "Dumbbells",
  "ai.cap.resistanceBands": "Resistance bands",
  "ai.cap.fullGym": "Full gym",
  "ai.cap.notesPlaceholder": "Injuries, preferences, time per session...",
  "ai.cap.destinationPlaceholder": "e.g. Istanbul, Turkey",
  "ai.cap.budgetOption": "Budget",
  "ai.cap.moderate": "Moderate",
  "ai.cap.luxury": "Luxury",
  "ai.cap.interestsPlaceholder": "e.g. history, food, nature",
  "ai.cap.accessibilityPlaceholder": "e.g. guided services, accessible venues...",
  "ai.cap.careerTitle": "Generate a Career Roadmap",
  "ai.cap.webBriefTitle": "Generate a Web Project Brief",
  "ai.cap.marketingCampaignTitle": "Generate a Marketing Campaign",
  "ai.cap.techTroubleshootingTitle": "Generate a Tech Troubleshooting Plan",
  "ai.cap.trainingCurriculumTitle": "Generate a Training Curriculum",
  "ai.cap.importChecklistTitle": "Generate an Import Sourcing Checklist",
  "ai.cap.targetRole": "Target role",
  "ai.cap.targetRolePlaceholder": "e.g. Accessibility tester, support specialist",
  "ai.cap.experience": "Experience",
  "ai.cap.currentSkills": "Current skills",
  "ai.cap.currentSkillsPlaceholder": "Tools, languages, certificates...",
  "ai.cap.accommodationNeeds": "Accessibility or accommodation needs (optional)",
  "ai.cap.accommodationPlaceholder": "Screen reader, flexible schedule, mobility needs...",
  "ai.cap.businessType": "Business type",
  "ai.cap.businessTypePlaceholder": "e.g. clinic, store, education platform",
  "ai.cap.projectGoal": "Project goal",
  "ai.cap.projectGoalPlaceholder": "e.g. collect bookings, sell products, teach lessons",
  "ai.cap.pagesFeatures": "Pages and features",
  "ai.cap.pagesFeaturesPlaceholder": "Home, services, checkout, chat, dashboard...",
  "ai.cap.accessibilityPriorities": "Accessibility priorities",
  "ai.cap.accessibilityPrioritiesPlaceholder": "Screen reader support, keyboard navigation, captions...",
  "ai.cap.productService": "Product or service",
  "ai.cap.productServicePlaceholder": "What are you promoting?",
  "ai.cap.audience": "Audience",
  "ai.cap.campaignAudiencePlaceholder": "Who should see this campaign?",
  "ai.cap.channel": "Channel",
  "ai.cap.socialMedia": "Social media",
  "ai.cap.email": "Email",
  "ai.cap.search": "Search",
  "ai.cap.multiChannel": "Multi-channel",
  "ai.cap.campaignGoal": "Campaign goal",
  "ai.cap.campaignGoalPlaceholder": "Awareness, leads, sales, event signups...",
  "ai.cap.deviceSystem": "Device or system",
  "ai.cap.deviceSystemPlaceholder": "Phone, laptop, app, screen reader...",
  "ai.cap.problem": "Problem",
  "ai.cap.problemPlaceholder": "Describe what happens and any error message",
  "ai.cap.technicalLevel": "Technical level",
  "ai.cap.assistiveTech": "Assistive technology involved",
  "ai.cap.assistiveTechPlaceholder": "NVDA, JAWS, VoiceOver, Braille display...",
  "ai.cap.topic": "Topic",
  "ai.cap.topicPlaceholder": "e.g. Customer support basics",
  "ai.cap.trainingAudiencePlaceholder": "Learners, staff, volunteers...",
  "ai.cap.duration": "Duration",
  "ai.cap.durationPlaceholder": "2 hours, 3 days, 6 weeks...",
  "ai.cap.deliveryFormat": "Delivery format",
  "ai.cap.online": "Online",
  "ai.cap.inPerson": "In person",
  "ai.cap.blended": "Blended",
  "ai.cap.accessibilitySupport": "Accessibility support",
  "ai.cap.accessibilitySupportPlaceholder": "Audio materials, captions, tactile examples...",
  "ai.cap.product": "Product",
  "ai.cap.productPlaceholder": "What do you want to source?",
  "ai.cap.originMarket": "Origin or market",
  "ai.cap.originMarketPlaceholder": "China, Turkey, local supplier...",
  "ai.cap.quantity": "Quantity",
  "ai.cap.quantityPlaceholder": "Sample, 100 units, container...",
  "ai.cap.estimatedBudget": "Estimated budget",
  "ai.cap.estimatedBudgetPlaceholder": "Approximate budget or price target",
  "ai.panel.bazaarTitle": "VXBazaar AI listing copilot",
  "ai.panel.bazaarDesc": "Improve the listing, pricing approach, accessibility text, and buyer clarity.",
  "ai.panel.writeListing": "Write listing",
  "ai.panel.accessibleAltText": "Accessible alt text",
  "ai.panel.returnPolicy": "Return policy",
  "ai.panel.pricingReview": "Pricing review",
  "ai.panel.trustCheck": "Trust check",
  "ai.panel.contentGuideTitle": "AI content guide",
  "ai.panel.contentGuideDesc": "Summarize, simplify, or turn the visible library into a learning path.",
  "ai.panel.recommendNext": "Recommend next",
  "ai.panel.learningPath": "Learning path",
  "ai.panel.accessibleOverview": "Accessible overview",
  "ai.panel.newsBriefTitle": "AI news brief",
  "ai.panel.newsBriefDesc": "Summarizes visible stories and explains terms without inventing facts.",
  "ai.panel.quickBrief": "Quick brief",
  "ai.panel.plainLanguage": "Plain language",
  "ai.panel.compareTopics": "Compare topics",
  "bazaar.choosePaymentPrice": "Choose a VX or cash price",
  "bazaar.contentFlagged": "This listing needs review before publishing. Please remove unsafe or prohibited content.",

  "ai.name.legalAdvisor": "Legal Advisor AI",
  "ai.name.medicalSupport": "Medical Support AI",
  "ai.name.psychology": "Psychology Support AI",
  "ai.name.empathyOasis": "Empathy Oasis AI",
  "ai.name.sportsCoach": "Sports Coach AI",
  "ai.name.skinCare": "Skin Care Expert AI",
  "ai.name.hairCare": "Hair Care Expert AI",
  "ai.name.travelAgency": "Travel Agency AI",
  "ai.name.socialGuide": "Social Guide AI",
  "ai.name.careerHub": "Career Hub AI",
  "ai.name.educationalEmpire": "Educational Empire AI",
  "ai.name.musicConservatory": "Music Conservatory AI",
  "ai.name.webDesign": "Web Design Consultant AI",
  "ai.name.digitalMarketing": "Digital Marketing Consultant AI",
  "ai.name.techConsulting": "Tech Consulting AI",
  "ai.name.importPurchasing": "Import & Purchasing AI",
  "ai.name.professionalTraining": "Professional Training AI",
  "ai.name.globalStudio": "Global Studio AI",
  "ai.name.bazaarCopilot": "VXBazaar Copilot",
  "ai.name.deliveryPlanner": "Accessible Route Planner AI",
  "ai.name.sharedTripPlanner": "Shared Trip Planner AI",
  "ai.name.businessAnalyst": "Business Analyst AI",
  "ai.name.contentGuide": "Content Accessibility AI",
  "ai.name.messageAssistant": "Message Assistant AI",
  "ai.name.mediaCompanion": "Live Media Companion AI",
  "ai.name.voiceRoomAssistant": "Voice Room Assistant AI",
  "ai.name.simulationMentor": "Simulation Mentor AI",
};

function parseFile(lang) {
  const file = path.join(i18nDir, `${lang}.ts`);
  const text = fs.readFileSync(file, "utf8");
  const entries = [];
  const re = /"((?:\\.|[^"\\])+)"\s*:\s*"((?:\\.|[^"\\])*)"/g;
  let match;
  while ((match = re.exec(text))) {
    entries.push({
      key: JSON.parse(`"${match[1]}"`),
      value: JSON.parse(`"${match[2]}"`),
    });
  }
  return { file, entries };
}

function serialize(entries) {
  return `export const translations: Record<string, string> = {\n${entries
    .map(({ key, value }) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`)
    .join("\n")}\n};\n\nexport default translations;\n`;
}

async function translate(text, target) {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=" +
    encodeURIComponent(target) +
    "&dt=t&q=" +
    encodeURIComponent(text);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json();
  return data[0].map((part) => part[0]).join("");
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await mapper(items[index], index);
      }
    }),
  );
  return results;
}

const en = parseFile("en");
const enKeys = new Set(en.entries.map((entry) => entry.key));
for (const [key, value] of Object.entries(englishAdds)) {
  if (!enKeys.has(key)) en.entries.push({ key, value });
}
fs.writeFileSync(en.file, serialize(en.entries), "utf8");

for (const [lang, target] of Object.entries(targets)) {
  const parsed = parseFile(lang);
  const existing = new Set(parsed.entries.map((entry) => entry.key));
  const missing = Object.entries(englishAdds).filter(([key]) => !existing.has(key));
  console.log(`${lang}: ${missing.length} missing AI UI keys`);
  if (missing.length) {
    const translated = await mapLimit(missing, 8, async ([key, value]) => ({
      key,
      value: await translate(value, target),
    }));
    parsed.entries.push(...translated);
    fs.writeFileSync(parsed.file, serialize(parsed.entries), "utf8");
  }
}
