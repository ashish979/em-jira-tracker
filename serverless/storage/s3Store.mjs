// Deployment note:
// Add @aws-sdk/client-s3 when we switch CACHE_BACKEND=s3.
// Keeping this adapter separate lets local development stay dependency-free.

export function createS3Store({ bucket }) {
  if (!bucket) throw new Error("S3 bucket is required.");

  async function getJson() {
    throw new Error("S3 store is not installed yet. Add @aws-sdk/client-s3 before AWS deployment.");
  }

  async function putJson() {
    throw new Error("S3 store is not installed yet. Add @aws-sdk/client-s3 before AWS deployment.");
  }

  return { getJson, putJson };
}
