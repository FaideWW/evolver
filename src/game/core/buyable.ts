import { Accessor, createSignal } from "solid-js";
import { Resource } from "@core/resource";
import { ScaleFn } from "@core/utils";

export interface Buyable {
  resource: Resource;
  cost: (p?: number, c?: number) => number;
  purchased: Accessor<number>;
  buy: (n?: number, ignoreCost?: boolean) => void;
  canBuy: () => boolean;
  canAfford: (n?: number) => boolean;
}

export interface BuyableConfig {
  resource: Resource;
  cost: ScaleFn;
  limit?: number;
}

export function createBuyable(cfg: BuyableConfig) {
  const [purchased, setPurchased] = createSignal(0);
  const costFn = (p = purchased(), c = 1) => cfg.cost(p + (c - 1));
  const limit = cfg.limit ?? Infinity;
  const canBuy = () => purchased() < limit;
  const canAfford = (n = 1) => cfg.resource.current() >= costFn(purchased(), n);
  return {
    resource: cfg.resource,
    cost: costFn,
    purchased,
    buy: (n = 1, ignoreCost = false) => {
      if ((canBuy() && canAfford(n)) || ignoreCost === true) {
        !ignoreCost && cfg.resource.sub(costFn(purchased(), n));
        setPurchased((prev) => prev + n);
      }
    },
    canBuy,
    canAfford,
  };
}
