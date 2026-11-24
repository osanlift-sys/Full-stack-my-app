import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";

test("unsafe requests attach CSRF tokens and recover from an expired token", async (t) => {
  let csrfRequests = 0;
  let mutationRequests = 0;
  const receivedTokens = [];
  const server = createServer((req, res) => {
    if (req.url === "/api/v1/auth/csrf") {
      csrfRequests += 1;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ csrfToken: `csrf-${csrfRequests}` }));
      return;
    }

    if (req.url === "/api/v1/auth/logout" && req.method === "POST") {
      mutationRequests += 1;
      receivedTokens.push(req.headers["x-csrf-token"]);
      if (mutationRequests === 1) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { code: "CSRF_VALIDATION_FAILED" } }));
        return;
      }

      res.writeHead(204);
      res.end();
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));

  const { port } = server.address();
  globalThis.process.env.VITE_API_BASE_URL = `http://127.0.0.1:${port}/api/v1`;
  const { apiClient } = await import(`./apiClient.js?test=${port}`);

  await apiClient.post("/auth/logout");

  assert.equal(apiClient.defaults.withCredentials, true);
  assert.equal(csrfRequests, 2);
  assert.equal(mutationRequests, 2);
  assert.deepEqual(receivedTokens, ["csrf-1", "csrf-2"]);
});
