import { createSignal } from "solid-js";
import { data } from "./data";
import { bus } from "./events";
import { createStatefulResource } from "./resource";
import { unlockOnEvent, unlockOnResourceThreshold } from "./unlockable";
import { applyUpgrades, createUpgrade } from "./upgrade";
import { additive, clamp, multiplicative } from "./utils";

export const bits = createStatefulResource(1, Infinity, {
  uncapped: true,
  create: () => ({ flips: [new Date(0)] }),
});

// TODO: find an elegant way to integrate these
export const bitCost = (p = bits.current(), c = 1) =>
  multiplicative(2, 8)(p - 1 + c - 1);
export const buyBit = (n: number = 1) => {
  const cost = bitCost(bits.current() - 1 + (n - 1));
  if (data.current() >= cost) {
    data.sub(cost);
    bits.add(n);
    bus.emit("buy-bit", { newBitCount: bits.current() });
  }
};
const [lastMuxClick, setLastMuxClick] = createSignal(new Date(0));

export const bitParallelFlipUpgrade = createUpgrade({
  costResource: data,
  cost: multiplicative(1.15, 64),
  unlocks: (cost) => unlockOnResourceThreshold(data, cost(0)),
  effect: additive(1),
});
export const bitParallelFlips = applyUpgrades(1, [bitParallelFlipUpgrade]);

export const bitFlipCooldownUpgrade = createUpgrade({
  costResource: data,
  cost: multiplicative(1.2, 32),
  unlocks: unlockOnResourceThreshold(bits, 4),
  effect: multiplicative(1 / 1.1),
});
export const bitFlipCooldown = applyUpgrades(1000, [bitFlipCooldownUpgrade]);

export const bitsFlippedUpgrade = createUpgrade({
  costResource: data,
  cost: multiplicative(1.15, 64),
  unlocks: unlockOnEvent("buy-autoflipper", () => true),
  effect: additive(1),
});
export const bitsFlipped = applyUpgrades(1, [bitsFlippedUpgrade]);

export const bitFlipAddedInfoUpgrade = createUpgrade({
  costResource: data,
  cost: multiplicative(1.2, 32),
  unlocks: unlockOnResourceThreshold(bits, 4),
  effect: additive(1),
});

export const bitInfoPerFlip = applyUpgrades(1, [bitFlipAddedInfoUpgrade]);

export const bitFlipCooldownProgress = (bitIndex: number, time: Date) =>
  bits
    .get(bitIndex)
    .flips.map((flip) =>
      clamp(0, 1, (time.getTime() - flip.getTime()) / bitFlipCooldown())
    );

export const bitMuxCooldownProgress = (
  now: Date,
  lastClick: Date = lastMuxClick()
) => {
  const nextRefresh = nextBitRefresh(now);
  return clamp(
    0,
    1,
    (now.getTime() - lastClick.getTime()) /
      (nextRefresh.getTime() - lastClick.getTime())
  );
};

export const bitAvailableAt = (bitIndex: number) =>
  new Date(
    Math.min(...bits.get(bitIndex).flips.map((flip) => flip.getTime())) +
      bitFlipCooldown()
  );

export const bitFlippable = (bitIndex: number, time: Date) =>
  bitFlipCooldownProgress(bitIndex, time).some((prog) => prog >= 1) ||
  bits.get(bitIndex).flips.length < bitParallelFlipUpgrade.effect();

export const nextBitRefresh = (time: Date = new Date()) => {
  let nextRefresh: Date | undefined = undefined;
  for (let i = 0; i < bits.current(); i++) {
    if (bitFlippable(i, time)) {
      return time;
    } else {
      const refreshAt = bitAvailableAt(i);
      if (nextRefresh === undefined || nextRefresh > refreshAt) {
        nextRefresh = refreshAt;
      }
    }
  }
  return nextRefresh as Date;
};

export const firstAvailableBit = (time: Date) => {
  // bit mux is available if any bit is available
  for (let i = 0; i < bits.current(); i++) {
    if (bitFlippable(i, time)) {
      return i;
    }
  }
  return -1;
};

export const bitMuxAvailable = (time: Date) => {
  return firstAvailableBit(time) !== -1;
};

export const flipBit = (bitIndex: number, time: Date = new Date()) => {
  const addedInfo = bitInfoPerFlip();
  bits.update(bitIndex, (bit) => {
    if (bit.flips.length === bitParallelFlips()) {
      bit.flips.shift();
    }

    bit.flips.push(time);
  });
  data.add(addedInfo);

  bus.emit("flip-bit", {
    infoDelta: addedInfo,
    newInfo: data.current(),
  });
};
// separated for tracking manual clicks vs. automated flips
export const clickBit = (bitIndex: number, time: Date = new Date()) =>
  flipBit(bitIndex, time);

// export const buyAutoFlipper = () => {
//   setState(
//     produce((draft) => {
//       if (data.current() >= autoFlipperCost()) {
//         data.sub(autoFlipperCost());
//         draft.autoFlipper.purchased = true;
//         draft.autoFlipper.enabled = true;

//         autoFlipperCooldownUpgrade.unlock();
//       }
//     })
//   );
//   bus.emit("buy-autoflipper", {});
// };

export const flipBitMux = () => {
  const now = new Date();
  for (let i = 0; i < bitsFlipped(); i++) {
    // find any available bit and flip it
    const nextBit = firstAvailableBit(now);

    if (nextBit === -1) {
      return false;
    }

    clickBit(nextBit, now);
  }
  setLastMuxClick(now);
  return true;
};
