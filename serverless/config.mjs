import { readFileSync } from "node:fs";
import { createLocalStore } from "./storage/localStore.mjs";
import { createS3Store } from "./storage/s3Store.mjs";

export function loadRuntimeConfig(env = process.env) {
  const values = env === process.env ? { ...loadDotEnv(), ...env } : env;
  return {
    jira: {
      siteUrl: values.JIRA_SITE_URL,
      email: values.JIRA_EMAIL,
      apiToken: values.JIRA_API_TOKEN,
      emField: values.JIRA_EM_FIELD,
      supportFilterId: values.JIRA_SUPPORT_FILTER_ID,
    },
    cacheBackend: values.CACHE_BACKEND || "local",
    localCacheDir: values.LOCAL_CACHE_DIR || ".cache",
    s3Bucket: values.JIRA_CACHE_BUCKET,
  };
}

export function createCacheStore(config) {
  if (config.cacheBackend === "s3") {
    return createS3Store({ bucket: config.s3Bucket });
  }
  return createLocalStore({ root: config.localCacheDir });
}

function loadDotEnv() {
  try {
    return Object.fromEntries(
      readFileSync(".env", "utf8")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index), line.slice(index + 1)];
        }),
    );
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}
