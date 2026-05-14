/** @type {import('c8').Options} */
export default {
  all: true,
  src: ["."],
  include: ["server/**/*.ts", "client/src/**/*.ts"],
  exclude: ["**/*.test.ts", "**/*.spec.ts", "e2e/**", "node_modules/**"],
  branches: 90,
  lines: 90,
  functions: 90,
  statements: 90,
  reporter: ["text", "html", "lcov"],
};
