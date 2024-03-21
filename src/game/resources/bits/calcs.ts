import { applyUpgrades } from "@core/upgrade";
import { clamp } from "@core/utils";
import { bits } from "./base";
import {
  bitFlipAddedInfoUpgrade,
  bitFlipCooldownUpgrade,
  bitParallelFlipUpgrade,
  bitsFlippedUpgrade,
} from "./upgrades";

export const bitInfoPerFlip = applyUpgrades(1, [bitFlipAddedInfoUpgrade]);
export const bitParallelFlips = applyUpgrades(1, [bitParallelFlipUpgrade]);
export const bitFlipCooldown = applyUpgrades(1000, [bitFlipCooldownUpgrade]);
export const bitFlipCooldownProgress = (bitIndex: number, time: Date) =>
  bits
    .get(bitIndex)
    .flips.map((flip) =>
      clamp(0, 1, (time.getTime() - flip.getTime()) / bitFlipCooldown())
    );

export const bitsFlipped = applyUpgrades(1, [bitsFlippedUpgrade]);

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
