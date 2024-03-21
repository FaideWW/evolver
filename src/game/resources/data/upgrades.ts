import { unlockOnResourceThreshold } from "@core/unlockable";
import { createUpgrade } from "@core/upgrade";
import { multiplicative } from "@core/utils";
import { data } from "./base";

export const maxDataUpgrade = createUpgrade("maxData", {
  costResource: data,
  cost: multiplicative(1.5, 128),
  unlocks: (cost) => unlockOnResourceThreshold(data, cost(0)),
  effect: multiplicative(1.5),
});

data.applyUpgrade(maxDataUpgrade);
