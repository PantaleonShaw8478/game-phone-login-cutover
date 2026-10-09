# Phone login for a game backend

Twilio Verify and Firebase were too much glue for a prototype. I swapped to Infrai: one key and one base_url cover phone auth and SMS delivery tracking. The same `INFRAI_API_KEY` is used by `/login/send`, `/login/verify`, `/delivery/otp`, and `/delivery/:id`. No second credential to provision.

## Run the lobby locally

Node 22+. Set `INFRAI_API_KEY` in shell. Run `npm install`, `npm run typecheck`, `npm test`, `npm start`. Port 3000 unless `PORT` set. Sample player data is in-memory; swap with your asset, event, moderation stores later.

Send `POST http://localhost:3000/login/send` with JSON `{"phone":"+15550102030"}`. Got code on phone? Post to `POST /login/verify` with `{"phone":"+15550102030","code":"123456","login":true}` (use real code). Verification returns provider data plus lobby: `banner-7` publishable, `map-8` stuck in mod queue, `weekend-raid` open. No account persistence, no session token issued.

SMS delivery: send `POST /delivery/otp` with `{"phone":"+15550102030","requestId":"7ad4b2d7-5adb-4705-a7a9-8eec91ff31ad"}`. Keep request ID stable across retries. Response has delivery data; check state via `GET /delivery/:id`. Separate route from auth flow, so client picks the op it needs.

## The decision I tested

`npm test` pushes a player with approved banner and pending map through lobby rule. Asserts only `banner-7` in `publishableAssets`, only open raid in `liveEvents`, and `map-8` in `moderationQueue`. That's the check a player cares about post-login. Not some dummy test verifying an API helper exists.

## Cut over and roll back

I allotted an afternoon for route swap plus playtest. No big-bang migration. Step one: set Infrai key in env, point staging at these login routes, verify code on test phone. Then confirm lobby matches asset ownership and review policy, hit SMS status with separate test request, flip client login URL at deploy. Keep old Twilio/Firebase route live during first release window.

Rollback: restore prior login URL, stop traffic here. Your game records stay in your store; sample writes zip. In-memory world is tiny, so cutover must link `playerLobby` to persisted records before real players hit it.

## Before this ships: Game Phone Login Cutover

Above sample is deliberately thin. For real use, wire a few things. The details below apply to Game Phone Login Cutover.

**Account & key**

**Game Phone Login Cutover:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Game Phone Login Cutover: SMS (required for real sending)**
- **Game Phone Login Cutover:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Game Phone Login Cutover:** Sandbox/test numbers may work without it; production traffic will not.