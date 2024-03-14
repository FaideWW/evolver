import { Accessor, createSignal } from "solid-js";
import { Resource } from "./resource";
import { UnlockCondition, UnlockType, createUnlockable } from "./unlockable";
import { ScaleFn, applyMods } from "./utils";

export interface UpgradeConfig<T extends UnlockType> {
  costResource: Resource;
  cost: ScaleFn;
  unlocks:
    | UnlockCondition<T>
    | ((costFn: (n: number) => number) => UnlockCondition<T>);
  effect: ScaleFn;
}

export interface Upgrade {
  init: () => void;
  // TODO: implement this (move cleanup related stuff to here)
  cleanup: () => void;
  unlocked: () => boolean;
  unlock: () => void;
  cost: (p?: number, c?: number) => number;
  effect: ScaleFn;
  purchased: Accessor<number>;
  buy: (n?: number, ignoreCost?: boolean) => void;
}

export function createUpgrade<T extends UnlockType>(
  config: UpgradeConfig<T>
): Upgrade {
  const { costResource: resource, cost, effect, unlocks } = config;
  const [purchased, setPurchased] = createSignal(0);
  const effectWithPurchased: ScaleFn = (n = purchased()) => effect(n);
  effectWithPurchased.type = effect.type;
  const unlock = createUnlockable(
    typeof unlocks === "function" ? unlocks(cost) : unlocks
  );

  const costFn = (p = purchased(), c = 1) => cost(p + (c - 1));
  return {
    cost: costFn,
    effect: effectWithPurchased,
    init: () => {
      unlock.init();
    },
    cleanup: () => {},
    purchased,
    unlocked: unlock.unlocked,
    unlock: unlock.unlocked,
    buy: (num: number = 1, ignoreCost = false) => {
      if (resource.current() >= costFn(purchased(), num) || ignoreCost) {
        !ignoreCost && resource.sub(costFn(purchased(), num));
        setPurchased((prev) => prev + num);
      }
    },
  };
}

export type UpgradeFn = (deltaPurchased?: number[] | number) => number;

export function applyUpgrades(base: number, upgrades: Upgrade[]): UpgradeFn {
  return (deltaPurchased: number[] | number = 0) =>
    applyMods(
      base,
      upgrades.map((u, i) => {
        const d = Array.isArray(deltaPurchased)
          ? deltaPurchased[i]
          : deltaPurchased;
        const fn = () => u.effect(u.purchased() + d);
        fn.type = u.effect.type;
        return fn;
      })
    );
}
