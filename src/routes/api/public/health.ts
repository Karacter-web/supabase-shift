import { createFileRoute } from "@tanstack/react-router";

/** Ported from the legacy Python backend: GET /health. */
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({ status: "ok", app: "Karacter Hub | Deep Call Live" }),
    },
  },
});
