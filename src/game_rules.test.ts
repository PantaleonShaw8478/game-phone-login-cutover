import assert from "node:assert/strict";
import test from "node:test";
import { playerLobby } from "./game_rules.ts";

test("pending artwork stays out of the publishable lobby", () => {
  const lobby = playerLobby("+15550102030", {
    assets: [
      { id: "banner-7", ownerPhone: "+15550102030", moderation: "approved" },
      { id: "map-8", ownerPhone: "+15550102030", moderation: "pending" },
      { id: "other-9", ownerPhone: "+15550999999", moderation: "approved" },
    ],
    events: [{ id: "weekend-raid", open: true }, { id: "old-raid", open: false }],
    moderationQueue: [{ assetId: "map-8", reason: "community review" }],
  });
  assert.deepEqual(lobby.publishableAssets.map((asset) => asset.id), ["banner-7"]);
  assert.deepEqual(lobby.liveEvents.map((event) => event.id), ["weekend-raid"]);
  assert.deepEqual(lobby.moderationQueue.map((item) => item.assetId), ["map-8"]);
});
