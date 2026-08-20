/* eslint-disable react-refresh/only-export-components -- this is an entry module, not a component library: it mounts its own root and exports nothing */
/**
 * Development-only harness for playing one Arcade game in isolation.
 *
 * Reached through `arcade-lab.html`, which is not a Vite build input, so this
 * module never enters a production bundle. It exists because `GameEconomyGate`
 * requires a signed-in Supabase session: without it a developer cannot open a
 * game locally at all, and every gameplay change would have to be judged from
 * source alone.
 *
 * It mounts the real shell — `ArcadeGameExperience`, the real accessibility
 * provider, the real `gameManager` — so pause, restart and the result overlay
 * behave exactly as they do in the app. Only the economy gate is absent, so
 * server-settled rewards are not exercised here; those are covered by tests.
 */
import { Suspense, lazy, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LanguageProvider } from "@/contexts/LanguageProvider";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { SoundProvider } from "@/contexts/SoundProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ArcadeGameExperience } from "@/features/arcade/ArcadeGameExperience";
import { GAME_LOADERS } from "@/features/arcade/core/gameLoaders";
import { ARCADE_GAMES } from "@/features/arcade/catalog";
import "@/index.css";

const slug = new URLSearchParams(location.search).get("game") ?? "snake";

function Picker() {
  return (
    <nav aria-label="Arcade lab game picker" style={{ padding: "1rem", fontFamily: "system-ui" }}>
      <h1>Arcade lab</h1>
      <p>Append <code>?game=&lt;slug&gt;</code>. Unknown slug: <strong>{slug}</strong></p>
      <ul>{ARCADE_GAMES.map((game) => <li key={game.slug}><a href={`?game=${game.slug}`}>{game.slug}</a></li>)}</ul>
    </nav>
  );
}

function Lab() {
  const client = useMemo(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }), []);
  const loader = GAME_LOADERS[slug];
  const game = ARCADE_GAMES.find((item) => item.slug === slug);
  if (!loader || !game) return <Picker />;
  const Game = lazy(loader);

  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <TooltipProvider>
          <LanguageProvider>
            <SoundProvider>
              <MemoryRouter initialEntries={[game.to]}>
                <Routes>
                  <Route
                    path={game.to}
                    element={
                      <ArcadeGameExperience>
                        <Suspense fallback={<p>Loading game…</p>}><Game /></Suspense>
                      </ArcadeGameExperience>
                    }
                  />
                </Routes>
              </MemoryRouter>
            </SoundProvider>
          </LanguageProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

// Cached so a hot update re-renders the existing root instead of creating a
// second one on the same container, which React reports as an error.
const container = document.getElementById("arcade-lab")! as HTMLElement & { __labRoot?: ReturnType<typeof createRoot> };
container.__labRoot ??= createRoot(container);
container.__labRoot.render(<Lab />);
