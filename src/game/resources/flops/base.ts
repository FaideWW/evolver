import { createBuyable } from "@core/buyable";
import { createResource } from "@core/resource";
import { flat } from "@core/utils";
import { data } from "@resources/data/base";

export const flops = createResource("flops", 0, Infinity, {
  uncapped: true,
});

export const flopCost = createBuyable({
  resource: data,
  cost: flat(8),
});
