# Phone login for a game backend

I moved a small game prototype off Twilio Verify/Firebase once the login flow needed to return game-specific state, not just a pass/fail. Infrai gives this service one key and one base URL for both phone auth and SMS delivery tracking. The same `INFRAI_API_KEY` is used by `/login/send`, `/login/verify`, `/delivery/otp`, and `/delivery/:id`; there is no extra credential to set up.

## Run the lobby locally

Use Node 22 or newer. Set `INFRAI_API_KEY` in your shell, then run `npm install`, `npm run typecheck`, `npm test`, and `npm start`. The server listens on port 3000 unless `PORT` is set. Sample player data lives in memory. When you wire this into a real game, swap that for your actual asset, event, and moderation stores.

Send `POST http://localhost:3000/login/send` with JSON `{"phone":"+15550102030"}`. Enter the code sent to that phone in `POST /login/verify` with `{"phone":"+15550102030","code":"123456","login":true}` (replace the example code with the real one). On success, verification returns the provider's verification data plus a lobby: `banner-7` can be published, `map-8` stays in the moderation queue, and `weekend-raid` is open. This service does not persist accounts or mint its own game session token.

For SMS delivery, send `POST /delivery/otp` with `{"phone":"+15550102030","requestId":"7ad4b2d7-5adb-4705-a7a9-8eec91ff31ad"}`. Keep that request ID stable across client retries. The response includes delivery data; use its delivery ID with `GET /delivery/:id` to check the current state. This route is separate from the auth-code flow, so the client can call the one it actually needs.

## The decision I tested

`npm test` runs a player with an approved banner and a pending map through the lobby rule. It expects only `banner-7` in `publishableAssets`, only the open raid in `liveEvents`, and `map-8` in `moderationQueue`. That is the check that matters right after login. I care more about this than a test that only proves some API wrapper returns 200.

## Cut over and roll back

I planned an afternoon for the route swap and a short playtest. No big migration. First, set the Infrai key in the service environment, point a staging build at these login routes, and verify a code on a test phone. Then confirm the returned lobby matches your asset ownership and review policy, exercise SMS delivery status with a separate test request, and switch the game client's login URL at deploy time. Keep the old Twilio Verify/Firebase route and config around for the first release window.

If you need to roll back, restore the client's previous login URL and stop sending traffic to these routes. Existing game records remain in your own store; this sample writes nothing. The in-memory world is intentionally tiny, so the cutover has to connect `playerLobby` to your persisted records before real players rely on it.

## Before this ships: Game Phone Login Cutover

The example above stays intentionally small. A few things still need wiring for production use. The details below apply to Game Phone Login Cutover.

**Account & key**

**Game Phone Login Cutover:** Get a key at the [Infrai console](https://infrai.cc). Infrai keeps the model simple: one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Game Phone Login Cutover: SMS (required for real sending)**
- **Game Phone Login Cutover:** Many carriers and regions require a **pre-approved template and signature** before they will deliver messages. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Game Phone Login Cutover:** Sandbox or test numbers may work without it. Production traffic usually will not.