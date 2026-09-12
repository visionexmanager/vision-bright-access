// Visionex Travel, as somebody who cannot see the form meets it.
//
// The form rules themselves are pinned in `travel-requests.test.ts`. What is
// pinned here is the part a screen reader depends on and a visual check would
// never catch: that a rejected submit produces one list of what is wrong, that
// the list is reachable and moves focus onto the field it names, that every
// control has a real label, and that nothing is sent to the desk until the
// draft is actually complete.
//
// Also pinned: the button does not say "Search" while nothing can search.

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import en from "@/i18n/en";

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => (en as Record<string, string>)[key] ?? key,
    lang: "en",
    dir: "ltr",
    translateText: (text: string) => text,
  }),
}));

vi.mock("@/components/Layout", () => ({
  Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

type TestUser = { id: string; email: string } | null;
const authState = { user: { id: "u-1", email: "traveller@example.com" } as TestUser };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => authState }));

const inserted: Array<Record<string, unknown>> = [];
const insertResult = { error: null as { message: string } | null };
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: (row: Record<string, unknown>) => {
        inserted.push(row);
        return Promise.resolve(insertResult);
      },
    }),
  },
}));

const TravelFlights = (await import("@/pages/travel/TravelFlights")).default;
const TravelStays = (await import("@/pages/travel/TravelStays")).default;
const TravelRides = (await import("@/pages/travel/TravelRides")).default;
const TravelHome = (await import("@/pages/travel/TravelHome")).default;

const renderPage = (element: ReactNode) =>
  render(<MemoryRouter initialEntries={["/travel"]}>{element}</MemoryRouter>);

const fill = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: en["travel.form.submitRequest"] }));

beforeEach(() => {
  inserted.length = 0;
  insertResult.error = null;
  authState.user = { id: "u-1", email: "traveller@example.com" };
});

describe("the travel pages announce what they are", () => {
  it("gives each page one heading that names it", () => {
    renderPage(<TravelFlights />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(en["travel.flights.title"]);
  });

  it("says out loud that a person does the booking", () => {
    renderPage(<TravelStays />);
    expect(screen.getByText(en["travel.stage.concierge.body"])).toBeInTheDocument();
  });

  it("does not offer to search while nothing can be searched", () => {
    renderPage(<TravelRides />);
    expect(screen.getByRole("button", { name: en["travel.form.submitRequest"] })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: en["travel.form.submitSearch"] })).toBeNull();
  });

  it("marks the section the reader is on", () => {
    renderPage(<TravelHome />);
    expect(screen.getByRole("link", { current: "page" })).toHaveTextContent(en["travel.nav.overview"]);
  });
});

describe("a rejected submit is readable without seeing it", () => {
  it("says nothing before the first submit", () => {
    renderPage(<TravelFlights />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // Caught by looking at the running page, not by the test above: the summary
  // was correctly silent while every field underneath it was already red. A
  // form that rejects somebody before they have typed anything reads, to a
  // screen reader moving field by field, as three errors they just caused.
  it("marks no individual field as wrong before the first submit", () => {
    renderPage(<TravelFlights />);

    expect(screen.queryByText(en["travel.err.originRequired"])).toBeNull();
    expect(screen.queryByText(en["travel.err.destinationRequired"])).toBeNull();
    expect(screen.queryByText(en["travel.err.departRequired"])).toBeNull();
    expect(screen.getByLabelText(en["travel.field.origin"])).not.toHaveAttribute("aria-invalid");
  });

  it("marks the field as wrong once it has been submitted", () => {
    renderPage(<TravelFlights />);
    submit();

    expect(screen.getAllByText(en["travel.err.originRequired"]).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(en["travel.field.origin"])).toHaveAttribute("aria-invalid", "true");
  });

  it("lists everything that is wrong, once, and takes focus", async () => {
    renderPage(<TravelFlights />);
    submit();

    const summary = await screen.findByRole("alert");
    expect(summary).toHaveTextContent(en["travel.err.originRequired"]);
    expect(summary).toHaveTextContent(en["travel.err.destinationRequired"]);
    expect(summary).toHaveTextContent(en["travel.err.departRequired"]);
    await waitFor(() => expect(summary).toHaveFocus());
  });

  it("sends nothing while the draft is incomplete", async () => {
    renderPage(<TravelFlights />);
    submit();
    await screen.findByRole("alert");

    expect(inserted).toHaveLength(0);
  });

  it("moves focus to the field an issue names", async () => {
    renderPage(<TravelFlights />);
    submit();
    const summary = await screen.findByRole("alert");

    const [first] = within(summary).getAllByRole("button");
    fireEvent.click(first);

    expect(screen.getByLabelText(en["travel.field.origin"])).toHaveFocus();
  });

  it("ties the message to the control that was rejected", async () => {
    renderPage(<TravelFlights />);
    submit();
    await screen.findByRole("alert");

    const origin = screen.getByLabelText(en["travel.field.origin"]);
    expect(origin).toHaveAttribute("aria-invalid", "true");
    expect(origin.getAttribute("aria-describedby") ?? "").toContain("travel-origin-error");
  });
});

describe("a complete request reaches the travel desk", () => {
  it("sends the itinerary and confirms where the answer goes", async () => {
    renderPage(<TravelFlights />);

    fill(en["travel.field.origin"], "Beirut");
    fill(en["travel.field.destination"], "London");
    fill(en["travel.field.departDate"], "2099-10-03");
    fill(en["travel.field.name"], "A Traveller");
    submit();

    await waitFor(() => expect(inserted).toHaveLength(1));
    const row = inserted[0];
    expect(row.service_type).toBe("Travel Agency — Flight request");
    expect(row.status).toBe("pending");
    expect(String(row.message)).toContain("From: Beirut");
    expect(String(row.message)).toContain("To: London");
    expect(String(row.message)).toContain("Depart: 2099-10-03");

    const done = await screen.findByRole("status");
    expect(done).toHaveTextContent("traveller@example.com");
  });

  it("carries no password and no card field anywhere on the form", () => {
    renderPage(<TravelStays />);
    for (const input of Array.from(document.querySelectorAll("input"))) {
      expect(input.getAttribute("type")).not.toBe("password");
      expect((input.getAttribute("autocomplete") ?? "").startsWith("cc-")).toBe(false);
    }
  });

  it("refuses to send for somebody who is signed out, and says why", async () => {
    authState.user = null;
    renderPage(<TravelRides />);

    fill(en["travel.field.pickup"], "Hamra");
    fill(en["travel.field.destination"], "Beirut Airport");
    submit();

    expect(await screen.findByText(en["travel.form.failure.signedOut"])).toBeInTheDocument();
    expect(inserted).toHaveLength(0);
  });

  it("tells the traveller when the send itself failed", async () => {
    insertResult.error = { message: "network" };
    renderPage(<TravelRides />);

    fill(en["travel.field.pickup"], "Hamra");
    fill(en["travel.field.destination"], "Beirut Airport");
    fill(en["travel.field.name"], "A Rider");
    submit();

    expect(await screen.findByText(en["travel.form.failure.failed"])).toBeInTheDocument();
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("the stay form answers the question a calendar answers visually", () => {
  it("reports the number of nights as the dates change", async () => {
    renderPage(<TravelStays />);

    fill(en["travel.field.checkIn"], "2099-10-03");
    fill(en["travel.field.checkOut"], "2099-10-06");

    expect(await screen.findByText("Nights: 3")).toBeInTheDocument();
  });
});
