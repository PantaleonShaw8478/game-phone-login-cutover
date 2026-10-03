export type PlayerWorld = {
  assets: { id: string; ownerPhone: string; moderation: "pending" | "approved" | "rejected" }[];
  events: { id: string; open: boolean }[];
  moderationQueue: { assetId: string; reason: string }[];
};

export function playerLobby(phone: string, world: PlayerWorld) {
  const assets = world.assets.filter((asset) => asset.ownerPhone === phone);
  const pending = new Set(world.moderationQueue.map((item) => item.assetId));
  const publishableAssets = assets.filter(
    (asset) => asset.moderation === "approved" && !pending.has(asset.id),
  );
  return {
    assets,
    publishableAssets,
    liveEvents: world.events.filter((event) => event.open),
    moderationQueue: world.moderationQueue.filter((item) =>
      assets.some((asset) => asset.id === item.assetId),
    ),
  };
}
