import { Accessor, createSignal } from "solid-js";
import { ScaleFn } from "./utils";
import { EventType, Events, bus } from "./events";
import { Resource } from "./resource";
import { applyMods } from "./utils";

export type UnlockType = "on-event" | "manual";

export interface UnlockFunctions {
  "on-event": (costFn: ScaleFn, onUnlock: () => void) => void;
  manual: () => void;
}

export interface UnlockCondition<T extends UnlockType> {
  type: UnlockType;
  fn: UnlockFunctions[T];
}

export function unlockOnEvent<T extends EventType>(
  eventType: T,
  fn: (cost: (n: number) => number) => (event: Events[T]) => boolean
): UnlockCondition<"on-event"> {
  return {
    type: "on-event",
    fn: (costFn: (m: number) => number, onUnlock: () => void) => {
      bus.subscribe(eventType, (e, { unsubscribe }) => {
        const result = fn(costFn)(e);
        if (result) {
          onUnlock();
          unsubscribe();
        }
      });
    },
  };
}

export function manualUnlock(): UnlockCondition<"manual"> {
  return { type: "manual", fn: () => {} };
}

export interface UpgradeConfig<T extends UnlockType> {
  costResource: Resource;
  cost: ScaleFn;
  unlocks: UnlockCondition<T>;
  effect: ScaleFn;
}

export interface Upgrade {
  init: () => void;
  unlocked: () => boolean;
  unlock: () => void;
  cost: (p?: number, c?: number) => number;
  effect: ScaleFn;
  purchased: Accessor<number>;
  buy: (n?: number) => void;
}

export function createUpgrade<T extends UnlockType>(
  config: UpgradeConfig<T>
): Upgrade {
  const { costResource: resource, cost, effect, unlocks } = config;
  const [unlocked, setUnlocked] = createSignal(false);
  const [purchased, setPurchased] = createSignal(0);
  const effectWithPurchased: ScaleFn = (n = purchased()) => effect(n);
  effectWithPurchased.type = effect.type;

  const costFn = (p = purchased(), c = 1) => cost(p + (c - 1));
  return {
    cost: costFn,
    effect: effectWithPurchased,
    init: () =>
      unlocks.type === "on-event"
        ? unlocks.fn(cost, () => setUnlocked(true))
        : null,
    purchased,
    unlocked,
    unlock: () => unlocked() === false && setUnlocked(true),
    buy: (num: number = 1) => {
      if (resource.current() >= costFn(purchased(), num)) {
        resource.sub(costFn(purchased(), num));
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
