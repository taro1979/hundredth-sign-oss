const defaultPort = process.env.PORT ?? "4818";

export const E2E_BASE_URL =
  process.env.APP_URL ?? process.env.BASE_URL ?? `http://localhost:${defaultPort}`;
