import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/contexts/LanguageContext", () => {
  const language = { t: (key: string) => key, lang: "en", ready: true, dir: "ltr", setLang: () => {}, translateText: (value: string) => value };
  return { useLanguage: () => language };
});
vi.mock("@/contexts/SoundContext", () => ({ useSound: () => ({ playSound: () => {} }) }));

const streamCareerChat = vi.fn();
vi.mock("@/services/career/careerChat", () => ({
  streamCareerChat: (...args: unknown[]) => streamCareerChat(...args),
}));

import { AIChatInterface } from "./AIChatInterface";

afterEach(() => {
  cleanup();
  streamCareerChat.mockReset();
});

function ask(question: string) {
  fireEvent.change(screen.getByPlaceholderText("aiSuite.chat.placeholder"), { target: { value: question } });
  fireEvent.click(screen.getByRole("button", { name: /aiSuite\.chat\.send/ }));
}

describe("AI Career Assistant chat", () => {
  it("shows the model's streamed reply, not a canned one", async () => {
    streamCareerChat.mockImplementation(async (_messages, onToken: (s: string) => void) => {
      onToken("Start with");
      onToken("Start with a portfolio.");
      return "Start with a portfolio.";
    });
    render(<AIChatInterface onOpenModule={() => {}} />);
    ask("How do I get a remote job?");

    const log = await screen.findByRole("log");
    await waitFor(() => expect(log).toHaveTextContent("Start with a portfolio."));
    // Announced once, complete: the partial "Start with" never entered the log.
    expect(log.querySelectorAll(".justify-start")).toHaveLength(1);
    expect(streamCareerChat).toHaveBeenCalledWith(
      [{ role: "user", content: "How do I get a remote job?" }],
      expect.any(Function),
      expect.any(AbortSignal),
    );
    expect(document.activeElement).toBe(screen.getByPlaceholderText("aiSuite.chat.placeholder"));
  });

  it("sends the whole conversation on the next turn", async () => {
    const reply = (text: string) => async (_m: unknown, onToken: (s: string) => void) => { onToken(text); return text; };
    streamCareerChat.mockImplementationOnce(reply("First answer")).mockImplementationOnce(reply("Second answer"));
    render(<AIChatInterface onOpenModule={() => {}} />);
    ask("one");
    await waitFor(() => expect(screen.getByRole("log")).toHaveTextContent("First answer"));
    ask("two");
    await waitFor(() => expect(streamCareerChat).toHaveBeenCalledTimes(2));
    expect(streamCareerChat.mock.calls[1][0]).toEqual([
      { role: "user", content: "one" },
      { role: "assistant", content: "First answer" },
      { role: "user", content: "two" },
    ]);
  });

  it("announces a failure instead of inventing an answer", async () => {
    streamCareerChat.mockRejectedValue(new Error("503"));
    render(<AIChatInterface onOpenModule={() => {}} />);
    ask("Review my resume");

    expect(await screen.findByRole("alert")).toHaveTextContent("aiSuite.chat.error");
    // The question is back in the box, focused, ready to send again.
    const input = screen.getByPlaceholderText("aiSuite.chat.placeholder");
    expect(input).toHaveValue("Review my resume");
    expect(document.activeElement).toBe(input);
    // Only the user's own message is in the log — no assistant bubble at all.
    const log = screen.getByRole("log");
    expect(log.querySelectorAll(".justify-start")).toHaveLength(0);
    expect(log.querySelectorAll(".justify-end")).toHaveLength(1);
  });
});
