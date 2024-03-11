import { createResource } from "./resource";
import { createUpgrade, unlockOnResourceThreshold } from "./upgrade";
import { multiplicative } from "./utils";

export const data = createResource(0, 256);
export const maxDataUpgrade = createUpgrade({
  costResource: data,
  cost: multiplicative(1.5, 128),
  unlocks: unlockOnResourceThreshold(data, (cost) => cost(0)),
  effect: multiplicative(1.5),
});

data.applyUpgrade(maxDataUpgrade);
