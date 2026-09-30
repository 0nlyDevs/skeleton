/**
 * ESLint configuration.
 *
 * `eslint-config-next` 16 ships flat configs, so there is no `FlatCompat` shim
 * and no `extends` here: the config is one array evaluated top to bottom, where
 * each later entry may override an earlier one.
 *
 * The rule set is deliberately small beyond Next's own. Every extra rule is one
 * that catches a real class of bug in this codebase, with the reason written
 * next to it — a lint config nobody can justify gets disabled instead of fixed.
 */

import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "src/components/ui/**",
      "coverage/**",
      // Generated code. Linting it reports thousands of errors about a
      // bundler's output rather than about anything anyone wrote.
      "server.cjs",
      ".dev/**",
      "**/*.cjs",
      "tsconfig.tsbuildinfo",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      // A stray `console.log` in a server route is a data-leak vector.
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
      "no-var": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Keeps `import type` honest as types-only imports are erased at build
      // time; a value import of a type silently survives into the bundle.
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      /*
       * New in React's compiler-era lint rules, and stricter than the pattern it
       * describes: it reads the `setLoading(true)` that opens a fetch callback
       * as "state set synchronously in an effect".
       *
       * Kept as a warning rather than turned off, because it is right often
       * enough to be worth seeing — but the load/error/finish lifecycle in the
       * data-loading components is a deliberate choice, and the alternative
       * (a Suspense server component per list) would cost more than it buys
       * here. The genuinely redundant cases it found have been removed.
       */
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // Tests, seeds and CLI scripts print to the terminal — that is their output
    // channel, not a leak. Application code keeps the restriction.
    files: ["tests/**/*.{ts,tsx}", "prisma/**/*.ts", "scripts/**/*.{ts,mts,mjs,js}"],
    rules: { "no-console": "off" },
  },
];

export default eslintConfig;
