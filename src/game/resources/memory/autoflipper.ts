import { createBuyable } from "@core/buyable";
import { createRoutine } from "@core/routines";
import { manualUnlock } from "@core/unlockable";
import { applyUpgrades, createUpgrade } from "@core/upgrade";
import { KB, multiplicative } from "@core/utils";
import { flipBitMux } from "@resources/bits/actions";
import { data } from "@resources/data/base";
import { produce } from "solid-js/store";

export const autoFlipperCooldownUpgrade = createUpgrade("autoFlipperCooldown", {
  costResource: data,
  cost: multiplicative(1.15, 128),
  unlocks: manualUnlock(),
  effect: multiplicative(1 / 1.2),
});
export const autoFlipperCooldown = applyUpgrades(2000, [
  autoFlipperCooldownUpgrade,
]);

export const autoFlipperRoutine = createRoutine("autoflipper", {
  type: "generator",
  initialState: () => ({ lastFlip: new Date(0) }),
  tick: ([state, setState], { newTime }) => {
    const cd = autoFlipperCooldown();
    const since = newTime.getTime() - state().lastFlip.getTime();
    if (since >= cd) {
      if (flipBitMux()) {
        setState(
          produce((draft) => {
            draft.lastFlip = newTime;
          })
        );
      }
    }
  },
  memoryCost: 1,
  status: "buyable",
});

export const autoFlipperCost = createBuyable({
  resource: data,
  cost: multiplicative(1, 1 * KB),
  limit: 1,
});
