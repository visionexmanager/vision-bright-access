import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ComponentType, ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { AuthProvider } from "@/contexts/AuthProvider";
import { LanguageProvider } from "@/contexts/LanguageProvider";
import { SoundProvider } from "@/contexts/SoundProvider";
import { GAME_LOADERS } from "@/features/arcade/core/gameLoaders";

function Harness({ children, path }: { children: ReactNode; path: string }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <LanguageProvider>
          <AuthProvider>
            <SoundProvider>{children}</SoundProvider>
          </AuthProvider>
        </LanguageProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

afterEach(cleanup);

describe("arcade game smoke", () => {
  const slugs = Object.keys(GAME_LOADERS);
  const failures: string[] = [];

  it.each(slugs)("renders %s without throwing", { timeout: 20000 }, async (slug) => {
    let Game: ComponentType;
    try {
      Game = (await GAME_LOADERS[slug]()).default;
    } catch (error) {
      failures.push(`${slug}: import failed — ${(error as Error).message}`);
      throw error;
    }
    expect(Game, `${slug} has no default export`).toBeTypeOf("function");
    render(
      <Harness path={`/games/${slug}`}>
        <Game />
      </Harness>,
    );
  });
});
