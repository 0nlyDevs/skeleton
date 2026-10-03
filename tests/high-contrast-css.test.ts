import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The F23 high-contrast theme is a promise: links are underlined and focus rings
 * are thick, in both themes. That promise used to break in two quiet ways that no
 * unit test would catch — `outline-width` cannot repaint a ring whose
 * `outline-style` a utility set to `none`, and `a:not([class*="bg-"])` is a
 * substring test that silently swallows hover-only backgrounds and skips links
 * outside `<main>`. These checks read the stylesheet directly so a rewrite that
 * drops either guarantee fails the suite.
 */
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "app", "globals.css");
const css = readFileSync(file, "utf8");
const highContrast = css.slice(css.indexOf('html[data-contrast="high"]'), css.indexOf("@media (prefers-reduced-motion"));

describe("high-contrast theme", () => {
  it("restores a full focus outline, not just a width", () => {
    expect(highContrast).toMatch(/:focus-visible\s*\{[^]*outline:\s*3px\s+solid[^;]*;/);
    expect(highContrast).not.toMatch(/outline-width:\s*3px/);
  });

  it("underlines links by a robust rule, not a class-substring hack", () => {
    expect(highContrast).toContain("a:not([role])");
    expect(highContrast).not.toMatch(/a:not\(\[class\*/);
    // Nav lives outside <main>; the rule must reach it.
    expect(highContrast).not.toMatch(/main\s+a/);
  });
});