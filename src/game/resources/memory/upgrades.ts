import { unlockOnResourceThreshold } from "@core/unlockable";
import { applyUpgrades, createUpgrade } from "@core/upgrade";
import { KB, additive, multiplicative } from "@core/utils";
import { data } from "@resources/data/base";

export const maxMemoryUpgrade = createUpgrade("maxMemory", {
  costResource: data,
  cost: multiplicative(2, 1 * KB),
  unlocks: (cost) => unlockOnResourceThreshold(data, cost(0)),
  effect: additive(1),
});

export const maxMemory = applyUpgrades(0, [maxMemoryUpgrade]);
