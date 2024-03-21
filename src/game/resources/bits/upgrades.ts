import { unlockOnEvent, unlockOnResourceThreshold } from "@core/unlockable";
import { createUpgrade } from "@core/upgrade";
import { additive, multiplicative } from "@core/utils";
import { data } from "@resources/data/base";
import { bits } from "./base";

export const bitParallelFlipUpgrade = createUpgrade("parallelFlips", {
  costResource: data,
  cost: multiplicative(1.15, 64),
  unlocks: (cost) => unlockOnResourceThreshold(data, cost(0)),
  effect: additive(1),
});
export const bitFlipCooldownUpgrade = createUpgrade("flipCD", {
  costResource: data,
  cost: multiplicative(1.2, 32),
  unlocks: unlockOnResourceThreshold(bits, 4),
  effect: multiplicative(1 / 1.1),
});
export const bitsFlippedUpgrade = createUpgrade("bitsFlipped", {
  costResource: data,
  cost: multiplicative(1.15, 64),
  unlocks: unlockOnEvent("buy-autoflipper", () => true),
  effect: additive(1),
});
export const bitFlipAddedInfoUpgrade = createUpgrade("addedInfo", {
  costResource: data,
  cost: multiplicative(1.2, 32),
  unlocks: unlockOnResourceThreshold(bits, 4),
  effect: additive(1),
});
