import { describe, expect, it } from "vitest";

import { SERVICE_TYPE } from "@/features/travel/requests";
import { GLOBAL_SERVICE_TYPE } from "@/features/sourcing/requests";
import { nodeById } from "../../supabase/functions/_shared/whatsappCatalog.ts";
import { say } from "../../supabase/functions/_shared/whatsappStrings.ts";
import {
  NO_EMAIL,
  TRAVEL_FEATURE,
  TRAVEL_SERVICE_TYPE,
  buildTravelRequest,
  SHOP_SERVICE_TYPE,
  directLinks,
  looksLikeItinerary,
  parseDeskKind,
  parseRouteChoice,
  parseTravelDomain,
  readDetails,
} from "../../supabase/functions/_shared/whatsappTravel.ts";

describe("whatsapp travel request", () => {
  it("files under the same queue labels as the website", () => {
    expect(TRAVEL_SERVICE_TYPE.flights).toBe(SERVICE_TYPE.flights);
    expect(TRAVEL_SERVICE_TYPE.stays).toBe(SERVICE_TYPE.stays);
    expect(TRAVEL_SERVICE_TYPE.cars).toBe(SERVICE_TYPE.cars);
  });

  it.each([
    ["I want to book a flight to Dubai", "flights"],
    ["flight tickets please", "flights"],
    ["أريد حجز طيران إلى دبي", "flights"],
    ["book a hotel in Istanbul", "stays"],
    ["بدي حجز فندق في عمان", "stays"],
    ["I need to rent a car at the airport", "cars"],
    ["أريد تأجير سيارة", "cars"],
  ])("reads %s", (text, domain) => {
    expect(parseTravelDomain(text)).toBe(domain);
  });

  it.each([
    "my flight was delayed",
    "I am at the hotel",
    "what is the weather",
    "",
  ])("does not mistake %j for a request", (text) => {
    expect(parseTravelDomain(text)).toBeNull();
  });

  it("separates an opening intent from a full itinerary", () => {
    expect(looksLikeItinerary("book a flight")).toBe(false);
    expect(looksLikeItinerary("book a flight Amman to Dubai on 5 December for 2 people")).toBe(true);
  });

  it("refuses details too short to act on and caps long ones", () => {
    expect(readDetails("tomorrow")).toBeNull();
    expect(readDetails("x".repeat(5000))?.length).toBe(1200);
  });

  it("builds an anonymous row keyed on the phone, with no account", () => {
    const row = buildTravelRequest({ domain: "stays", details: "Cairo 3 nights, 2 adults", phone: "962790000000" });
    expect(row.user_id).toBeNull();
    expect(row.email).toBe(NO_EMAIL);
    expect(row.status).toBe("pending");
    expect(row.service_type).toBe(SERVICE_TYPE.stays);
    expect(row.message).toContain("Cairo");
  });

  it("is a catalog node and says in every language that nothing is charged", () => {
    expect(nodeById(TRAVEL_FEATURE)?.kind).toBe("action");
    expect(say("travelFiled", "en")).toMatch(/Nothing is booked or charged/);
  });

  it.each([
    ["I want to order from Amazon a kettle", "shop"],
    ["order a phone from aliexpress", "shop"],
    ["اطلب من علي اكسبرس حذاء", "shop"],
    ["بدي اشتري من امازون", "shop"],
    ["buy something on eBay", "shop"],
    ["book a hotel in Rome", "stays"],
  ])("reads the desk kind of %s", (text, kind) => {
    expect(parseDeskKind(text)).toBe(kind);
  });

  it.each(["the amazon river is long", "I like shein colours", "hello"])("does not order for %j", (text) => {
    expect(parseDeskKind(text)).toBeNull();
  });

  it.each([
    ["1", "direct"],
    ["١", "direct"],
    ["by myself", "direct"],
    ["بنفسي", "direct"],
    ["2", "staff"],
    ["٢", "staff"],
    ["the team please", "staff"],
    ["موظف", "staff"],
    ["maybe", null],
    ["", null],
  ])("reads the route %j", (text, route) => {
    expect(parseRouteChoice(text)).toBe(route);
  });

  it("sends the official links from the same directory the website shows", () => {
    expect(directLinks("shop")).toContain("Amazon: https://www.amazon.com/");
    expect(directLinks("shop")).toMatch(/AliExpress/);
    expect(directLinks("flights")).toMatch(/Skyscanner/);
    expect(directLinks("flights")).not.toMatch(/Hertz/);
    expect(directLinks("cars")).toMatch(/Hertz/);
  });

  it("files a store order under the same service type as the website", () => {
    const row = buildTravelRequest({ domain: "shop", details: "kettle, new, to Jordan", phone: "962790000000" });
    expect(row.service_type).toBe(SHOP_SERVICE_TYPE);
    expect(row.service_type).toBe(GLOBAL_SERVICE_TYPE.order);
    expect(row.user_id).toBeNull();
  });
});
