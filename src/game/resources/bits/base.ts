import { createStatefulResource } from "@core/resource";
import { multiplicative } from "@core/utils";
import { createBuyable } from "@core/buyable";
import { flops } from "@resources/flops/base";

export const bits = createStatefulResource("bits", 1, Infinity, {
  uncapped: true,
  create: () => ({ flips: [new Date(0)] }),
});

export const bitCost = createBuyable({
  resource: flops,
  cost: multiplicative(2, 8),
});
