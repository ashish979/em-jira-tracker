import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { refreshHandler } from "../serverless/handlers/refresh.mjs";

const port = Number(process.env.PORT || 4174);
const webRoot = join(process.cwd(), "web");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") {
      send(response, 204, "");
      return;
    }

    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    const refreshMatch = /^\/refresh\/([a-z-]+)$/.exec(url.pathname);

    if (request.method === "POST" && refreshMatch) {
      const body = await readBody(request);
      const result = await refreshHandler({
        section: refreshMatch[1],
        body,
      });
      send(response, result.statusCode, result.body, result.headers);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      send(response, 405, "Method not allowed");
      return;
    }

    const filePath = resolveStaticPath(url.pathname);
    const body = await readFile(filePath);
    const headers = { "content-type": contentTypes[extname(filePath)] || "application/octet-stream" };
    send(response, 200, request.method === "HEAD" ? "" : body, headers);
  } catch (error) {
    const status = error.code === "ENOENT" ? 404 : 500;
    send(response, status, JSON.stringify({ error: status === 404 ? "Not found" : error.message }), {
      "content-type": "application/json; charset=utf-8",
    });
  }
}).listen(port, () => {
  console.log(`Jira Command Center live dev server: http://localhost:${port}`);
});

function resolveStaticPath(pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const normalized = normalize(requested).replace(/^(\.\.[/\\])+/, "");
  return join(webRoot, normalized);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function send(response, statusCode, body, headers = {}) {
  response.writeHead(statusCode, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    ...headers,
  });
  response.end(body);
}
