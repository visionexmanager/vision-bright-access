// Keyboard and screen-reader access to the business simulators' controls.

import { render, screen } from "@testing-library/react";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { Slider } from "@/components/ui/slider";

const dir = join(process.cwd(), "src/pages/simulations");
const files = readdirSync(dir).filter((f) => f.endsWith(".tsx"));
const read = (f: string) => readFileSync(join(dir, f), "utf8");

/** Every `<Slider ...>` opening tag, which may span several lines. */
function sliderTags(source: string): string[] {
  const tags: string[] = [];
  const open = /<Slider\b/g;
  let m: RegExpExecArray | null;
  while ((m = open.exec(source))) {
    // The tag ends at the first `>` that is not the arrow of `=>`.
    let end = m.index;
    while (end < source.length && !(source[end] === ">" && source[end - 1] !== "=")) end++;
    tags.push(source.slice(m.index, end + 1));
  }
  return tags;
}

describe("the Slider component", () => {
  beforeAll(() => {
    // Radix measures the track; jsdom has no ResizeObserver.
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  it("puts the accessible name on the thumb, the element a screen reader lands on", () => {
    render(<Slider aria-label="Herd size" aria-valuetext="40 cattle" defaultValue={[40]} min={10} max={100} />);
    const thumb = screen.getByRole("slider", { name: "Herd size" });
    expect(thumb).toHaveAttribute("aria-valuenow", "40");
    expect(thumb).toHaveAttribute("aria-valuetext", "40 cattle");
  });

  it("can be named by visible text through aria-labelledby", () => {
    render(
      <>
        <span id="lbl">Fan speed</span>
        <Slider aria-labelledby="lbl" defaultValue={[2]} min={1} max={3} />
      </>,
    );
    expect(screen.getByRole("slider", { name: "Fan speed" })).toBeInTheDocument();
  });
});

describe("every slider in the simulators has a name", () => {
  it("carries aria-label or aria-labelledby", () => {
    const unnamed: string[] = [];
    for (const f of files) {
      sliderTags(read(f)).forEach((tag, i) => {
        if (!/aria-label(ledby)?=/.test(tag)) unnamed.push(`${f} #${i + 1}`);
      });
    }
    expect(unnamed).toEqual([]);
  });

  it("points aria-labelledby at an id that exists, once", () => {
    const broken: string[] = [];
    for (const f of files) {
      const source = read(f);
      for (const tag of sliderTags(source)) {
        const literal = /aria-labelledby="([^"]+)"/.exec(tag)?.[1];
        if (!literal) continue; // a template id (inside a list) is checked by hand
        const count = source.split(`id="${literal}"`).length - 1;
        if (count !== 1) broken.push(`${f}: ${literal} appears ${count} times`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("found a plausible number of sliders, so the checks above are not vacuous", () => {
    const total = files.reduce((n, f) => n + sliderTags(read(f)).length, 0);
    expect(total).toBeGreaterThanOrEqual(55);
  });
});

describe("order rows can be chosen from the keyboard", () => {
  it.each([
    ["AluminumGlazingSimulation.tsx", "selectOrder(o)"],
    ["LogisticsSimulation.tsx", "selectShipment(s)"],
    ["MobileRepairSimulation.tsx", "selectJob(j)"],
  ])("%s: the row's own button selects it", (file, call) => {
    const source = read(file);
    // The row keeps its mouse-only onClick; the Button inside it must do the same thing.
    expect(source).toContain(`onClick={(e) => { e.stopPropagation(); ${call}; }}`);
  });

  it("the Marine custom buttons answer Space as well as Enter", () => {
    const source = read("MarineVesselSimulation.tsx");
    const handlers = source.match(/onKeyDown=\{e => \{[^}]*e\.key === " "/g) ?? [];
    expect(handlers.length).toBe(2);
    expect(source).not.toContain('role="tab"');
  });
});
