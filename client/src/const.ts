export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

export const getLoginUrl = (returnPath?: string) => {
  const path =
    returnPath && returnPath.startsWith("/") ? returnPath : "/dashboard";
  return `/login?returnPath=${encodeURIComponent(path)}`;
};
