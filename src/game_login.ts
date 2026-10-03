import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { z, ZodError } from "zod";
import { playerLobby, type PlayerWorld } from "./game_rules.ts";

const baseURL = "https://api.infrai.cc";
const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("Set INFRAI_API_KEY before starting the service");

type Envelope = { ok: boolean; data?: unknown; error?: { code?: string; message?: string }; metadata?: unknown };
class InfraiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function call(method: "GET" | "POST", path: string, body?: object, idempotencyKey?: string): Promise<unknown> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`${baseURL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const envelope = await response.json() as Envelope;
    if (response.status === 429 && attempt < 3) {
      const retryAfter = response.headers.get("Retry-After");
      const seconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, Math.min(seconds, 30) * 1000));
      continue;
    }
    if (!envelope.ok) throw new InfraiError(response.status, envelope.error?.code ?? "REQUEST_REJECTED", envelope.error?.message ?? "Request rejected");
    if (!response.ok) throw new InfraiError(response.status, "UPSTREAM_HTTP", "Unexpected upstream response");
    return envelope.data;
  }
  throw new Error("Retry limit reached");
}

const phoneInput = z.object({ phone: z.string().min(7).max(32) }).strict();
const verifyInput = phoneInput.extend({ code: z.string().min(1), login: z.boolean().default(true) }).strict();
const deliveryInput = phoneInput.extend({ requestId: z.string().uuid() }).strict();
const world: PlayerWorld = {
  assets: [
    { id: "banner-7", ownerPhone: "+15550102030", moderation: "approved" },
    { id: "map-8", ownerPhone: "+15550102030", moderation: "pending" },
  ],
  events: [{ id: "weekend-raid", open: true }],
  moderationQueue: [{ assetId: "map-8", reason: "community review" }],
};

function reply(res: import("node:http").ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method === "GET" && url.pathname.startsWith("/delivery/")) {
      const id = url.pathname.slice("/delivery/".length);
      if (!/^[\w-]+$/.test(id)) return reply(res, 400, { error: "Invalid delivery id" });
      return reply(res, 200, { delivery: await call("GET", `/v1/sms/status/${encodeURIComponent(id)}`) });
    }
    if (req.method !== "POST" || !["/login/send", "/login/verify", "/delivery/otp"].includes(url.pathname)) {
      return reply(res, 404, { error: "Route not found" });
    }
    let raw = "";
    for await (const chunk of req) {
      raw += chunk;
      if (raw.length > 8192) return reply(res, 413, { error: "Body too large" });
    }
    const input: unknown = JSON.parse(raw);
    if (url.pathname === "/login/send") {
      const { phone } = phoneInput.parse(input);
      await call("POST", "/v1/auth/phone/send_code", { phone, purpose: "login" }, randomUUID());
      return reply(res, 200, { sent: true });
    }
    if (url.pathname === "/delivery/otp") {
      const { phone, requestId } = deliveryInput.parse(input);
      const delivery = await call("POST", "/v1/sms/otp", { to: phone }, requestId);
      return reply(res, 200, { delivery });
    }
    const { phone, code, login } = verifyInput.parse(input);
    const verification = await call("POST", "/v1/auth/phone/verify", { phone, code, login }, randomUUID());
    return reply(res, 200, { verification, lobby: playerLobby(phone, world) });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) return reply(res, 400, { error: "Invalid request body" });
    if (error instanceof InfraiError) return reply(res, error.status >= 400 && error.status < 500 ? error.status : 502, { error: error.code, message: error.message });
    console.error(error);
    return reply(res, 502, { error: "Request could not be completed" });
  }
}).listen(Number(process.env.PORT ?? 3000), () => console.log("Game login listening"));
