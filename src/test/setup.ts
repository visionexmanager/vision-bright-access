import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom ships neither observer. Radix primitives and the Arcade canvas games
// mount them during layout effects, so without these stubs a component test
// fails on the environment rather than on the component under test.
class StubObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}

for (const name of ["ResizeObserver", "IntersectionObserver"] as const) {
  if (!(name in window)) {
    Object.defineProperty(window, name, { writable: true, configurable: true, value: StubObserver });
    Object.defineProperty(globalThis, name, { writable: true, configurable: true, value: StubObserver });
  }
}

// jsdom defines getContext but throws "not implemented" from it, which turns
// every canvas-rendered game into console noise. A no-op 2D context lets the
// component mount so the test can assert on its behaviour instead.
const canvasContext2d = new Proxy(
  { canvas: null, measureText: () => ({ width: 0 }), createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }), getImageData: () => ({ data: new Uint8ClampedArray(4) }) },
  { get: (target, key) => (key in target ? Reflect.get(target, key) : () => undefined) },
);
window.HTMLCanvasElement.prototype.getContext = ((kind: string) =>
  kind === "2d" ? canvasContext2d : null) as unknown as HTMLCanvasElement["getContext"];

if (!window.HTMLMediaElement.prototype.play) {
  window.HTMLMediaElement.prototype.play = () => Promise.resolve();
}
