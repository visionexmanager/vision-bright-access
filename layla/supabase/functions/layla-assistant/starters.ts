// Sentence-opening words. Alexa's AMAZON.SearchQuery slot needs a carrier
// phrase, and the carrier is removed from the slot text. Each opener gets its
// own intent so the function can put the word back before asking the model.
export type Starter = { prefix: string; variants: string[] };

export const STARTERS: Record<string, Starter> = {
  WhatIntent: { prefix: "شو", variants: ["شو", "ما", "ماذا", "إيش"] },
  HowIntent: { prefix: "كيف", variants: ["كيف", "كيفية"] },
  WhyIntent: { prefix: "ليش", variants: ["ليش", "لماذا"] },
  WhoIntent: { prefix: "مين", variants: ["مين", "من", "من هو"] },
  WhereIntent: { prefix: "وين", variants: ["وين", "أين"] },
  HowManyIntent: { prefix: "كم", variants: ["كم", "قديش"] },
  WhenIntent: { prefix: "إيمتى", variants: ["إيمتى", "متى"] },
  IsIntent: { prefix: "هل", variants: ["هل"] },
  IamIntent: { prefix: "أنا", variants: ["أنا", "انا"] },
  YouIntent: { prefix: "إنت", variants: ["إنت", "أنتِ", "انتي"] },
  HeIntent: { prefix: "هو", variants: ["هو"] },
  SheIntent: { prefix: "هي", variants: ["هي"] },
  WeIntent: { prefix: "نحنا", variants: ["نحنا", "نحن"] },
  HaveIntent: { prefix: "عندي", variants: ["عندي", "عندنا"] },
  WantIntent: { prefix: "بدي", variants: ["بدي", "بدنا"] },
  LoveIntent: { prefix: "بحب", variants: ["بحب", "بحبّ"] },
  NotIntent: { prefix: "مش", variants: ["مش"] },
  NoIntent: { prefix: "لا", variants: ["لا", "لأ"] },
  YesIntent: { prefix: "إيه", variants: ["إيه", "أه", "نعم"] },
  ThanksIntent: { prefix: "شكراً", variants: ["شكراً", "شكرا", "يسلمو"] },
  OkIntent: { prefix: "تمام", variants: ["تمام", "ماشي", "أوكي", "منيح"] },
  ButIntent: { prefix: "بس", variants: ["بس", "لكن"] },
  BecauseIntent: { prefix: "لأن", variants: ["لأن", "لأنو"] },
  ThenIntent: { prefix: "وبعدين", variants: ["وبعدين", "بعدين"] },
  ImagineIntent: { prefix: "تخيلي", variants: ["تخيلي", "تخيل"] },
  HeardIntent: { prefix: "سمعت", variants: ["سمعت"] },
  SawIntent: { prefix: "شفت", variants: ["شفت"] },
  KnowIntent: { prefix: "بعرف", variants: ["بعرف"] },
  DontKnowIntent: { prefix: "ما بعرف", variants: ["ما بعرف"] },
  WasIntent: { prefix: "كنت", variants: ["كنت"] },
  WillIntent: { prefix: "رح", variants: ["رح"] },
  MustIntent: { prefix: "لازم", variants: ["لازم"] },
  CanIntent: { prefix: "فيني", variants: ["فيني", "فينا"] },
  LetsIntent: { prefix: "خلينا", variants: ["خلينا"] },
  ComeIntent: { prefix: "تعي", variants: ["تعي"] },
  ThisIntent: { prefix: "هيدا", variants: ["هيدا", "هيدي", "هاي", "هذا"] },
  IfIntent: { prefix: "إذا", variants: ["إذا", "لو"] },
  MaybeIntent: { prefix: "ممكن", variants: ["ممكن"] },
  CanYouIntent: { prefix: "بتقدري", variants: ["بتقدري", "بتعرفي"] },
  DoingIntent: { prefix: "عم", variants: ["عم"] },
  TodayIntent: { prefix: "اليوم", variants: ["اليوم", "أمس", "بكرا"] },
  ThereIsIntent: { prefix: "في", variants: ["في"] },
  EveryIntent: { prefix: "كل", variants: ["كل"] },
  SoIntent: { prefix: "يعني", variants: ["يعني"] },
  AndIntent: { prefix: "وكمان", variants: ["وكمان", "كمان"] },
  OkThenIntent: { prefix: "طيب", variants: ["طيب", "طب"] },
  HeyLaylaIntent: { prefix: "يا ليلى", variants: ["يا ليلى", "ليلى"] },
};

// Generic carriers that are not repeated in the question text.
export const CARRIERS = [
  "اسألي",
  "قولي",
  "احكي لي",
  "احكيلي",
  "بدي اعرف",
  "أريد أن أعرف",
  "عطيني",
  "خبريني",
  "فيكي",
  "ساعديني",
  "اشرحي",
  "جاوبيني",
  "عن",
  "ماذا عن",
];

export function questionWordFor(intentName: string): string {
  return STARTERS[intentName]?.prefix ?? "";
}

export function buildModel() {
  const slot = [{ name: "question", type: "AMAZON.SearchQuery" }];
  return {
    interactionModel: {
      languageModel: {
        invocationName: "مساعدتي ليلى",
        intents: [
          {
            name: "AskLaylaIntent",
            slots: slot,
            samples: CARRIERS.map((c) => `${c} {question}`),
          },
          ...Object.entries(STARTERS).map(([name, s]) => ({
            name,
            slots: slot,
            samples: s.variants.map((v) => `${v} {question}`),
          })),
          { name: "AMAZON.HelpIntent", samples: [] },
          { name: "AMAZON.StopIntent", samples: [] },
          { name: "AMAZON.CancelIntent", samples: [] },
          { name: "AMAZON.FallbackIntent", samples: [] },
        ],
        types: [],
      },
    },
  };
}
