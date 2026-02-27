// Central site configuration — change these when migrating to skills.internetcomputer.org
export const SITE_URL = "https://dfinity.github.io/icskills";
export const BASE_PATH = "/icskills";

/** Prefix a path with the base path */
export function withBase(path: string): string {
  if (path.startsWith(BASE_PATH)) return path;
  return `${BASE_PATH}${path}`;
}
