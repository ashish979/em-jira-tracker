import { createLocalStore } from "./storage/localStore.mjs";
import { createS3Store } from "./storage/s3Store.mjs";

export function loadRuntimeConfig(env = process.env) {
  return {
    jira: {
      siteUrl: env.JIRA_SITE_URL,
      email: env.JIRA_EMAIL,
      apiToken: env.JIRA_API_TOKEN,
      emField: env.JIRA_EM_FIELD,
    },
    cacheBackend: env.CACHE_BACKEND || "local",
    localCacheDir: env.LOCAL_CACHE_DIR || ".cache",
    s3Bucket: env.JIRA_CACHE_BUCKET,
  };
}

export function createCacheStore(config) {
  if (config.cacheBackend === "s3") {
    return createS3Store({ bucket: config.s3Bucket });
  }
  return createLocalStore({ root: config.localCacheDir });
}
