// The tappable interface: every message that carries something to press.
//
// Menus, the language list, the gender rows, the country shortlist, and the
// two-button footer under a question. One module, because they are one design
// decision repeated — and because a raw Meta payload written inline in the
// webhook is a payload nobody can test and everybody copies.
//
// ── What replaced the numbers ───────────────────────────────────────────────
//
// Every row carries a name and a stable id. Never a number: a number is a
// position, positions move, and a menu row that means "3" cannot be read aloud
// into anything a person can act on. Never the label either — a label is a
// translation, and `assistant.ask` has to keep meaning Ask AI on the day
// somebody improves the French for it.
//
// The row title *is* the meaning. That is the accessibility rule this whole
// file exists to hold: a screen reader announces the title and nothing else, so
// a title must make sense on its own, must not be an emoji, must not be an
// abbreviation, and must not depend on the row above it.
//
// ── What Meta will and will not take ────────────────────────────────────────
//
// Ten rows in a list, in total, across every section — not ten per section.
// Three reply buttons. 24 characters on a row title, 20 on a button, 72 on a
// row description. Every one of those is a rejection, not a truncation: a
// message one character over is never delivered and the sender is left staring
// at silence. So everything here is clipped as a last resort and the suite
// asserts nothing real ever reaches the clip.
//
// Every interactive message has a text twin. Meta refuses interactive messages
// outright outside the 24-hour service window, and a menu that exists only
// inside a modal is a menu half this audience cannot reach.

import {
  childrenOf,
  isAvailable,
  isFlaggedOff,
  LIST_LIMITS,
  localized,
  nodeById,
  offeredChildrenOf,
  pathTo,
  ROOT_ID,
  type CatalogNode,
  type Language,
} from "./whatsappCatalog.ts";
import {
  countryChoices,
  countryRowId,
  countryRowTitle,
  COUNTRY_OTHER_ID,
} from "./whatsappCountries.ts";
import {
  languagePageId,
  languageRowId,
  languagesOnPage,
  LANGUAGE_PAGE_COUNT,
  nextLanguagePage,
} from "./whatsappLanguages.ts";
import { newsRowId } from "./whatsappNews.ts";
import { songRowId, songSubtitle, type Song } from "./whatsappSongs.ts";
import { BACK_ID, genderRowId } from "./whatsappOnboarding.ts";
import { GENDERS } from "./whatsappProfile.ts";
import { say } from "./whatsappStrings.ts";
import { sendWhatsAppInteractive, sendWhatsAppText } from "./whatsapp.ts";
import { trace } from "./whatsappTelemetry.ts";

/** The id the "start again from the top" control carries, everywhere. */
export const MAIN_MENU_ID = "main_menu";
export { BACK_ID };

// ── Shapes ───────────────────────────────────────────────────────────────────

export interface Row {
  id: string;
  title: string;
  description?: string;
}

export interface InteractiveList {
  type: "list";
  header: { type: "text"; text: string };
  body: { text: string };
  action: {
    button: string;
    sections: Array<{ title: string; rows: Row[] }>;
  };
}

export interface InteractiveButtons {
  type: "button";
  body: { text: string };
  action: { buttons: Array<{ type: "reply"; reply: { id: string; title: string } }> };
}

export type InteractiveMessage = InteractiveList | InteractiveButtons;

/** An interactive message and the words that say the same thing without it. */
export interface Tappable {
  interactive: InteractiveMessage;
  /** Sent instead when Meta refuses the interactive one. Always says the same thing. */
  text: string;
}

const clip = (text: string, limit: number): string =>
  [...text].length <= limit ? text : `${[...text].slice(0, limit - 1).join("").trimEnd()}…`;

/**
 * Rows, or buttons when there are few enough and they fit.
 *
 * Three or fewer is a button message: the choices are on screen without opening
 * anything, which is one fewer gesture and — for somebody navigating by touch
 * exploration — one fewer surface to get lost in. Four or more has to be a
 * list, because Meta allows only three buttons.
 *
 * And a button title may be 20 characters where a row title may be 24, which is
 * a difference no translator can be expected to hold in their head. So a set of
 * labels that would not fit on buttons becomes a list instead of becoming four
 * words and an ellipsis: «Поговорить с челове…» read aloud is not a choice
 * anybody can make. The shape gives way, never the label.
 */
function compose(header: string, body: string, rows: Row[], language: Language): InteractiveMessage {
  const fitsOnButtons = rows.every((row) => [...row.title].length <= LIST_LIMITS.buttonTitle);
  if (rows.length <= LIST_LIMITS.buttons && fitsOnButtons) {
    return {
      type: "button",
      body: { text: clip(body, LIST_LIMITS.body) },
      action: {
        buttons: rows.map((row) => ({
          type: "reply",
          reply: { id: row.id, title: clip(row.title, LIST_LIMITS.buttonTitle) },
        })),
      },
    };
  }
  return {
    type: "list",
    header: { type: "text", text: clip(header, LIST_LIMITS.header) },
    body: { text: clip(body, LIST_LIMITS.body) },
    action: {
      button: clip(say("menuButton", language), LIST_LIMITS.button),
      sections: [{
        title: clip(header, LIST_LIMITS.rowTitle),
        rows: rows.slice(0, LIST_LIMITS.rows).map((row) => ({
          id: row.id,
          title: clip(row.title, LIST_LIMITS.rowTitle),
          ...(row.description ? { description: clip(row.description, LIST_LIMITS.rowDescription) } : {}),
        })),
      }],
    },
  };
}

/** The same choices as words, for when Meta refuses the message above. */
function asText(header: string, body: string, rows: Row[], language: Language): string {
  const lines = rows.map((row) => `• ${row.title}${row.description ? ` — ${row.description}` : ""}`);
  return [`*${header}*`, body, "", ...lines, "", say("textMenuHint", language)]
    .filter((line, index) => index !== 1 || !!body)
    .join("\n");
}

// ── The way out, on every message that has one ───────────────────────────────

/**
 * The control rows under a menu or a question.
 *
 * At the top there is nowhere to go, so nothing is offered. Everywhere else
 * both are, Back first, because Back is the one people reach for.
 *
 * One level down the two lead to the same place, and this used to offer only
 * Back there for exactly that reason. The instruction now is that both are
 * always present, and the argument for it is better than the argument against:
 * "Main menu" is a promise about where you will end up, "Back" is a promise
 * about undoing the last thing you did, and somebody who cannot see the screen
 * should not have to work out that on this particular menu they coincide. The
 * cost is one row, and on the two smallest menus it is the difference between
 * three buttons and a four-row list.
 */
export function controlRows(nodeId: string, language: Language): Row[] {
  if (pathTo(nodeId).length <= 1) return [];
  return [
    { id: BACK_ID, title: say("back", language) },
    { id: MAIN_MENU_ID, title: say("mainMenu", language) },
  ];
}

// ── Menus ────────────────────────────────────────────────────────────────────

/**
 * One menu, tappable.
 *
 * Null when the node has no children a sender may see, which is not an error:
 * a flag can switch off everything under a submenu, and answering that with an
 * empty list would be a message with nothing in it.
 *
 * A feature the catalog has declared but not built stays on the menu and says
 * so in its description. A feature a live flag has switched off is gone from
 * the menu entirely — see `visibleChildrenOf` for why the two differ.
 */
export function menuMessage(
  nodeId: string,
  language: Language,
  disabled: readonly string[] = [],
): Tappable | null {
  const node = nodeById(nodeId);
  if (!node) return null;

  const controls = controlRows(nodeId, language);
  // `offeredChildrenOf` applies the same ten-row ceiling this used to apply
  // inline. It is the catalog's answer now because the router needs the same
  // one: a row that does not fit on the menu is a row nobody can have tapped,
  // and an id naming it is refused rather than executed.
  const children = offeredChildrenOf(nodeId, disabled);
  if (children.length === 0) return null;

  const rows = [...children.map((child) => featureRow(child, language, disabled)), ...controls];
  const header = localized(node.title, language);
  const body = localized(node.description, language);

  return {
    interactive: compose(header, body, rows, language),
    text: asText(header, body, rows, language),
  };
}

/**
 * The follow-up questions a shared pin makes answerable, in the order they are
 * asked in practice. "Where am I" is not among them: the message these rows sit
 * under has already answered it.
 */
const LOCATION_FOLLOW_UPS = ["services.weather", "services.nearby"] as const;

/**
 * A pin, answered in one message with the next questions attached.
 *
 * Sharing a location used to produce two messages in a row — where you are,
 * then the weather, whether or not anybody wanted the weather — and no way to
 * ask for anything else except by knowing the words and typing them. Two
 * messages is two notifications, two things to swipe past, and a forecast
 * nobody asked for read aloud before the sentence they were waiting for.
 *
 * So: one message, and the choices travel with it. The rows carry catalog ids,
 * which is what makes this cheap — a tap on `services.weather` arrives as that
 * id *and* as the row's own title, so it lands in the same branch a typed
 * "الطقس" lands in and no route had to be invented for it.
 *
 * Null when a flag has switched off every follow-up, which is not an error: the
 * caller then sends the place as ordinary text, and a message with an empty
 * list under it is not an improvement on that.
 */
export function locationMessage(params: {
  language: Language;
  /** The "you are here" answer, formatted and localised by the caller. */
  place: string;
  /** A short name for the list header — the city, when one could be found. */
  title: string;
  disabled?: readonly string[];
}): Tappable | null {
  const { language, place, title, disabled = [] } = params;

  const rows: Row[] = [];
  for (const id of LOCATION_FOLLOW_UPS) {
    const node = nodeById(id);
    if (!node || !isAvailable(node, disabled)) continue;
    rows.push({
      id: node.id,
      title: localized(node.title, language),
      description: localized(node.description, language),
    });
  }
  if (rows.length === 0) return null;

  // The way out, for the same reason every list here has one: somebody who
  // cannot see the screen needs the exit to be a row, not a guess.
  rows.push({ id: MAIN_MENU_ID, title: say("mainMenu", language) });

  // A list header cannot render markdown, so the place name is used plainly
  // and the generic word stands in when the geocoders could not name anywhere.
  const header = title.trim() || say("menuButton", language);
  return {
    interactive: compose(header, place, rows, language),
    text: asText(header, place, rows, language),
  };
}

/**
 * What is around you, as places you can tap rather than places you were told.
 *
 * This was a paragraph of bullets. Somebody was told a pharmacy was 300 m
 * north-east of them and that was the end of it — the one thing they wanted
 * next, to be taken there, was the one thing the message could not do. Asked
 * for directions outright, the assistant offered them and then could not
 * deliver, which is worse than never offering: the sender has no reason to
 * suspect the words they used were the problem.
 *
 * Now each place is a row, and a tap sends that place's location message, which
 * the sender's own maps application navigates from. The distance and bearing
 * stay in the description, because "300 m north-east" is what decides whether
 * somebody walks or calls a taxi, and it has to be heard before the choice
 * rather than after it.
 *
 * Eight places and two controls is Meta's ten exactly, which is why the caller's
 * `NEARBY_LIMIT` is eight and not nine.
 */
export function nearbyMessage(params: {
  language: Language;
  /** The heading and the bullets, already formatted — the text twin's body. */
  heading: string;
  places: Array<{ id: string; title: string; description: string }>;
}): Tappable | null {
  const { language, heading, places } = params;
  if (places.length === 0) return null;

  const rows: Row[] = [
    ...places.slice(0, LIST_LIMITS.rows - 2).map((place) => ({
      id: place.id,
      title: place.title,
      description: place.description,
    })),
    { id: BACK_ID, title: say("back", language) },
    { id: MAIN_MENU_ID, title: say("mainMenu", language) },
  ];

  const body = say("nearbyTapHint", language);
  return {
    interactive: compose(heading, body, rows, language),
    text: asText(heading, body, rows, language),
  };
}

/** One feature as a row: its own name, its own words, its own id. */
function featureRow(node: CatalogNode, language: Language, disabled: readonly string[]): Row {
  const soon = !isAvailable(node, disabled) && !isFlaggedOff(node, disabled);
  const description = localized(node.description, language);
  return {
    id: node.id,
    // The emoji trails the words and carries nothing. A screen reader that
    // announces it says the name first; one that skips it loses nothing.
    title: `${localized(node.title, language)}${node.emoji ? ` ${node.emoji}` : ""}`,
    description: soon ? `${description} — ${say("disabled", language)}` : description,
  };
}

/**
 * A question with nothing to tap but a way back.
 *
 * Used for the free-text steps of onboarding and for a feature that has just
 * opened and is waiting to be told something. The sentence is the body; the
 * buttons are the exit — so "how do I get out of this" has a visible answer at
 * every point, which is exactly what the numeric `0` never had.
 */
export function questionMessage(
  text: string,
  language: Language,
  controls: Row[],
): Tappable | null {
  if (controls.length === 0) return null;
  return {
    interactive: compose(text, text, controls, language),
    text: [text, "", ...controls.map((row) => `• ${row.title}`)].join("\n"),
  };
}

// ── Language ─────────────────────────────────────────────────────────────────

/**
 * The language list — the first thing a new sender ever sees.
 *
 * Written in English, because nothing yet knows what else to write it in, and
 * kept to three words for the same reason. The rows are the languages
 * themselves, each titled in its own script with its English name underneath,
 * exactly as the site's language switcher shows them: the native name is what a
 * reader recognises, and the English one is what lets somebody find a language
 * whose script they cannot yet read.
 *
 * Twenty languages do not fit in ten rows, so the tenth row turns the page. It
 * always goes forward and wraps at the end, so the list has no dead end and a
 * sender who overshoots simply keeps going round.
 */
export function languageMessage(page: number): Tappable {
  const index = Number.isInteger(page) && page >= 1 && page <= LANGUAGE_PAGE_COUNT ? page : 1;
  const rows: Row[] = languagesOnPage(index).map((choice) => ({
    id: languageRowId(choice.code),
    title: choice.native,
    description: choice.english,
  }));

  const next = nextLanguagePage(index);
  rows.push({
    id: languagePageId(next),
    title: next === 1 ? "Back to the first page" : "More languages",
  });

  const header = "Welcome to Visionex";
  const body = "Your language:";
  return {
    interactive: {
      type: "list",
      header: { type: "text", text: header },
      body: { text: body },
      action: {
        button: "Languages",
        sections: [{ title: "Languages", rows: rows.map((row) => ({ ...row, title: clip(row.title, LIST_LIMITS.rowTitle) })) }],
      },
    },
    text: [
      `*${header}*`,
      body,
      "",
      ...rows.map((row) => `• ${row.title}${row.description ? ` — ${row.description}` : ""}`),
    ].join("\n"),
  };
}

// ── The profile questions that are a choice ──────────────────────────────────

/** How the sender would like to be referred to. Four rows, so a list. */
export function genderMessage(language: Language): Tappable {
  const label: Record<(typeof GENDERS)[number], string> = {
    male: say("genderMale", language),
    female: say("genderFemale", language),
    other: say("genderOther", language),
    undisclosed: say("genderUndisclosed", language),
  };
  const rows: Row[] = GENDERS.map((value) => ({ id: genderRowId(value), title: label[value] }));
  rows.push({ id: BACK_ID, title: say("back", language) });

  const header = say("askGender", language);
  return {
    interactive: compose(header, header, rows, language),
    text: [header, "", ...rows.map((row) => `• ${row.title}`)].join("\n"),
  };
}

/**
 * Which country, offered rather than typed.
 *
 * The first row is the country the sender's own dialling prefix points at,
 * which is right far more often than not and puts the answer one tap away —
 * which for somebody using a screen reader is the difference between this
 * question and a paragraph of typing. It is a suggestion and never a default:
 * nothing is written until they choose.
 *
 * The last row leaves the list, because a shortlist is a shortlist and the
 * hundred and ninety countries not on it are not "other people".
 */
export function countryMessage(language: Language, phone: string): Tappable {
  const rows: Row[] = countryChoices(phone).map((country) => ({
    id: countryRowId(country.code),
    title: countryRowTitle(country, language),
  }));
  rows.push({ id: COUNTRY_OTHER_ID, title: say("countryOther", language) });

  const header = say("askCountry", language);
  const body = say("askCountry", language);
  return {
    interactive: compose(header, body, rows, language),
    text: [
      body,
      "",
      ...rows.map((row) => `• ${row.title}`),
      "",
      say("countryTypeHint", language),
    ].join("\n"),
  };
}

// ── Sending ──────────────────────────────────────────────────────────────────
//
// Three named helpers rather than a Meta payload written out inside the
// webhook. The authentication, the retry policy and the never-log-the-body rule
// all live in `sendWhatsAppInteractive`, which these call: nothing here opens a
// socket or knows a token, and the webhook stays orchestration.

export interface Delivery {
  /** Absent when the sending credentials are not configured. Nothing is posted. */
  phoneNumberId?: string;
  token?: string;
  to: string;
  /**
   * Write the message into the transcript.
   *
   * Called with the *text* twin, whichever version actually went out, so the
   * thread reads as a conversation for whoever triages it later — and is called
   * even when nothing can be sent, because "we tried to say this" is exactly
   * what a reader of a broken deployment needs to see.
   */
  record?: (text: string) => Promise<void>;
  /** The delivery's correlation id, for the lines this prints. */
  trace?: string;
}

/**
 * Send one tappable message, falling back to its own words.
 *
 * The fallback is not a lesser copy — it lists the same rows with the same
 * names, and the names are what the router resolves against the menu in view,
 * so a sender who only ever gets the text version can still reach everything.
 *
 * Returns whether the interactive version was accepted, which is worth logging:
 * a run of refusals means something is wrong with the payloads rather than with
 * one sender's phone.
 */
export async function sendTappable(to: Delivery, message: Tappable): Promise<boolean> {
  if (to.record) await to.record(message.text);
  if (!to.token || !to.phoneNumberId) return false;

  const accepted = await sendWhatsAppInteractive({
    phoneNumberId: to.phoneNumberId,
    token: to.token,
    to: to.to,
    interactive: message.interactive as unknown as Record<string, unknown>,
  });
  if (!accepted) {
    console.error(`[whatsapp] interactive message refused; sent the same choices as text${trace(to.trace)}`);
    await sendWhatsAppText({
      phoneNumberId: to.phoneNumberId,
      token: to.token,
      to: to.to,
      body: message.text,
    });
  }
  return accepted;
}

/** One menu, by node id. Returns null when the menu had nothing to show. */
export async function sendInteractiveMenu(
  to: Delivery,
  nodeId: string,
  language: Language,
  disabled: readonly string[] = [],
): Promise<Tappable | null> {
  const message = menuMessage(nodeId, language, disabled);
  if (message) await sendTappable(to, message);
  return message;
}

// ── A menu for somebody who asked out loud ───────────────────────────────────

export type MenuMedium = "interactive" | "voice";

export interface MenuTransport {
  /** Post the tappable message, falling back to its own words. */
  tap(message: Tappable): Promise<boolean>;
  /** Read the menu aloud. Returns whether any of it was delivered. */
  speak(text: string): Promise<boolean>;
}

export interface MenuDelivery {
  medium: MenuMedium;
  sent: boolean;
  /** Set when audio was chosen, failed, and the tappable message went instead. */
  spokenFailed: boolean;
}

/**
 * Recorded, but with no way to send it.
 *
 * The answer when this delivery has no Meta token or phone number id: the
 * transcript row exists and nothing went out. It lives here rather than being
 * written out at each call site because a `medium:` decided anywhere but
 * `replyMedium` is the mistake the webhook's own suite watches for, and a
 * caller returning `null` instead only moves that decision one line later.
 */
export const MENU_NOT_DELIVERED: MenuDelivery = {
  medium: "interactive",
  sent: false,
  spokenFailed: false,
};

/**
 * Deliver one menu in the medium the sender used.
 *
 * ── Why a spoken menu is a real menu ────────────────────────────────────────
 *
 * A tappable list read aloud would be a second copy of something already on
 * screen, so a voice sender gets the words and only the words. That works
 * because a name is now a way to choose: the router resolves a row's title
 * against the menu in view, and the legacy numbers still resolve too. Somebody
 * who hears "AI Assistant, Voice Assistant, OCR and photos" can answer with any
 * of those and land exactly where a tap would have put them.
 *
 * ── The documented fallback ─────────────────────────────────────────────────
 *
 * If synthesis fails there is nothing to hear, and a menu nobody received is a
 * dead end rather than a degraded experience — so the tappable message goes
 * instead. It is the one case where a voice sender is shown text, it is
 * recorded as such, and it is tested.
 */
export async function deliverMenu(
  params: { message: Tappable; spokenInput: boolean },
  transport: MenuTransport,
): Promise<MenuDelivery> {
  if (!params.spokenInput) {
    return { medium: "interactive", sent: await transport.tap(params.message), spokenFailed: false };
  }

  if (await transport.speak(params.message.text)) {
    return { medium: "voice", sent: true, spokenFailed: false };
  }

  console.error("[whatsapp-tts] a spoken menu could not be delivered; sent the tappable one");
  return { medium: "voice", sent: await transport.tap(params.message), spokenFailed: true };
}

/**
 * The latest headlines, as a tappable list.
 *
 * Built here rather than in the webhook for the same reason every other
 * interactive payload is: one place knows Meta's limits, and the suite asserts
 * the webhook builds none of them itself.
 *
 * The rows carry article ids, so a tap says exactly which article without the
 * conversation having to remember a list it showed earlier. The way back is a
 * control row rather than a sentence, because News hangs off the main menu and
 * a list with no way out is a trap for somebody who cannot see the screen.
 */
export function newsMessage(params: {
  articles: Array<{ id: string; title: string; description: string }>;
  language: Language;
}): Tappable {
  const { articles, language } = params;
  const heading = say("newsHeading", language);
  const rows: Row[] = articles.map((article) => ({
    id: newsRowId(article.id),
    title: article.title,
    ...(article.description ? { description: article.description } : {}),
  }));
  rows.push(...controlRows("news", language));

  return {
    interactive: {
      type: "list",
      header: { type: "text", text: clip(heading.replace(/\*/g, ""), LIST_LIMITS.header) },
      body: { text: clip(say("newsBackHint", language), LIST_LIMITS.body) },
      action: {
        button: clip(say("newsButton", language), LIST_LIMITS.button),
        sections: [{
          title: clip(say("newsButton", language), LIST_LIMITS.rowTitle),
          rows: rows.map((row) => ({
            ...row,
            title: clip(row.title, LIST_LIMITS.rowTitle),
            ...(row.description ? { description: clip(row.description, LIST_LIMITS.rowDescription) } : {}),
          })),
        }],
      },
    },
    text: [
      heading,
      "",
      ...articles.map((article) => `• ${article.title}`),
      "",
      say("newsBackHint", language),
    ].join("\n"),
  };
}

/**
 * What the catalogue found, as rows that can be tapped.
 *
 * The artist is the row's description rather than part of its title, because
 * five results for one song are usually five performers, and that is the line
 * somebody chooses on — heard second, immediately after the title, whether they
 * are reading the list or having it read to them.
 */
export function songsMessage(params: { songs: Song[]; language: Language }): Tappable {
  const { songs, language } = params;
  const heading = say("songHeading", language);
  const rows: Row[] = songs.map((song) => ({
    id: songRowId(song.trackId),
    title: song.title,
    ...(songSubtitle(song) ? { description: songSubtitle(song) } : {}),
  }));
  rows.push(...controlRows("services.songs", language));

  return {
    interactive: {
      type: "list",
      header: { type: "text", text: clip(heading.replace(/\*/g, ""), LIST_LIMITS.header) },
      body: { text: clip(say("songChoose", language), LIST_LIMITS.body) },
      action: {
        button: clip(say("songButton", language), LIST_LIMITS.button),
        sections: [{
          title: clip(say("songButton", language), LIST_LIMITS.rowTitle),
          rows: rows.map((row) => ({
            ...row,
            title: clip(row.title, LIST_LIMITS.rowTitle),
            ...(row.description ? { description: clip(row.description, LIST_LIMITS.rowDescription) } : {}),
          })),
        }],
      },
    },
    text: [
      heading,
      "",
      ...songs.map((song) => {
        const subtitle = songSubtitle(song);
        return subtitle ? `• ${song.title} — ${subtitle}` : `• ${song.title}`;
      }),
      "",
      say("songChoose", language),
    ].join("\n"),
  };
}

/** The search results, delivered. */
export async function sendSongList(
  to: Delivery,
  songs: Song[],
  language: Language,
): Promise<Tappable> {
  const message = songsMessage({ songs, language });
  await sendTappable(to, message);
  return message;
}

/** The headlines, delivered. */
export async function sendNewsList(
  to: Delivery,
  articles: Array<{ id: string; title: string; description: string }>,
  language: Language,
): Promise<Tappable> {
  const message = newsMessage({ articles, language });
  await sendTappable(to, message);
  return message;
}

/** The language list, at a page. Written in English: nothing yet knows better. */
export async function sendLanguageMenu(to: Delivery, page: number): Promise<Tappable> {
  const message = languageMessage(page);
  await sendTappable(to, message);
  return message;
}

/** One of the profile questions that is a choice rather than a sentence. */
export async function sendProfileChoice(
  to: Delivery,
  choice: "gender" | "country",
  language: Language,
  phone: string,
): Promise<Tappable> {
  const message = choice === "gender" ? genderMessage(language) : countryMessage(language, phone);
  await sendTappable(to, message);
  return message;
}

/** A sentence with a way back under it, and nothing else to press. */
export async function sendQuestion(
  to: Delivery,
  text: string,
  language: Language,
  controls: Row[],
): Promise<Tappable | null> {
  const message = questionMessage(text, language, controls);
  if (message) await sendTappable(to, message);
  return message;
}

// ── The sender's own cloned voices ───────────────────────────────────────────

/**
 * The list of voices this sender may answer in.
 *
 * Built here rather than in `whatsappVoiceChoice.ts` for the same reason every
 * other menu is: `compose` decides between buttons and a list by measuring the
 * labels, and a voice name is user-supplied text of unknown length. Two voices
 * plus the default is three buttons if the names are short and a list if they
 * are not — which is exactly the decision `compose` already makes correctly.
 */
export function voiceChoiceMessage(
  rows: Array<{ id: string; title: string; description?: string }>,
  language: Language,
): Tappable | null {
  if (rows.length === 0) return null;
  const header = say("voiceMyVoicesHeading", language);
  const body = say("voiceMyVoicesBody", language);
  return {
    interactive: compose(header, body, rows, language),
    text: asText(header, body, rows, language),
  };
}

/** Send it. Returns the message so the caller can remember what was offered. */
export async function sendVoiceChoice(
  to: Delivery,
  rows: Array<{ id: string; title: string; description?: string }>,
  language: Language,
): Promise<Tappable | null> {
  const message = voiceChoiceMessage(rows, language);
  if (message) await sendTappable(to, message);
  return message;
}
