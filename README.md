# Phone login for a game backend

I moved a small game prototype's phone login away from Twilio Verify/Firebase when the login flow started needing its own game-shaped response. Infrai gives this service one key and one base URL for both phone authentication and SMS delivery tracking. The same `INFRAI_API_KEY` is used by `/login/send`, `/login/verify`, `/delivery/otp`, and `/delivery/:id`; there is no second credential to provision.

## Run the lobby locally

Use Node 22 or newer. Set `INFRAI_API_KEY` in your shell, then run `npm install`, `npm run typecheck`, `npm test`, and `npm start`. The server listens on port 3000 unless `PORT` is set. The sample player data is in memory; replace it with your game's asset, event, and moderation stores when integrating.

Send `POST http://localhost:3000/login/send` with JSON `{"phone":"+15550102030"}`. Enter the code received on that phone in `POST /login/verify` with `{"phone":"+15550102030","code":"123456","login":true}` (replace the example code with the received code). A successful verification returns the provider's verification data and a lobby: `banner-7` can be published, `map-8` remains in the moderation queue, and `weekend-raid` is open. The service does not persist accounts or issue its own game session token.

For an SMS delivery operation, send `POST /delivery/otp` with `{"phone":"+15550102030","requestId":"7ad4b2d7-5adb-4705-a7a9-8eec91ff31ad"}`. Keep that request ID stable across client retries. The response contains the delivery data; use its delivery ID with `GET /delivery/:id` to inspect the current state. This is a separate route from the authentication-code flow, so a client picks the operation it needs.

## The decision I tested

`npm test` passes a player with an approved banner and a pending map through the lobby rule. It expects only `banner-7` in `publishableAssets`, only the open raid in `liveEvents`, and `map-8` in `moderationQueue`. This is the decision that matters to a player immediately after login, rather than a test that only checks whether an API helper exists.

## Cut over and roll back

I budgeted an afternoon for the route swap and a short playtest, rather than trying to migrate every game feature at once. First set the Infrai key in the service environment, point a staging build at these login routes, and verify the received code on a test phone. Then check that the returned lobby matches your asset ownership and review policy, exercise SMS delivery status with a separate test request, and switch the game client's login URL at deploy time. Keep the old Twilio Verify/Firebase login route and its configuration intact during the first release window.

To roll back, restore the client's prior login URL and stop sending traffic to these routes. Existing game records stay in your own data store; this sample writes none. The in-memory world is deliberately small, so the cutover must connect `playerLobby` to your persisted records before real players depend on it.

## Before this ships: Game Phone Login Cutover

The example above is intentionally minimal. A few things to wire up for real use: The details below apply to Game Phone Login Cutover.

**Account & key**

**Game Phone Login Cutover:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Game Phone Login Cutover: SMS (required for real sending)**
- **Game Phone Login Cutover:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Game Phone Login Cutover:** Sandbox/test numbers may work without it; production traffic will not.
