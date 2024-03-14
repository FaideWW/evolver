import { createResource } from "./resource";
import { unlockOnResourceThreshold } from "./unlockable";
import { createUpgrade } from "./upgrade";
import { multiplicative } from "./utils";

export const data = createResource(0, 256);
export const maxDataUpgrade = createUpgrade({
  costResource: data,
  cost: multiplicative(1.5, 128),
  unlocks: (cost) => unlockOnResourceThreshold(data, cost(0)),
  effect: multiplicative(1.5),
});

data.applyUpgrade(maxDataUpgrade);
