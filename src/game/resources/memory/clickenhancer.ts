import { bus } from "@core/events";
import { data } from "@resources/data/base";
import { createRoutine } from "@core/routines";
import { bits } from "@resources/bits/base";
import { multiplicative, KB } from "@core/utils";
import { createBuyable } from "@core/buyable";

export const clickEnhancer = createRoutine("enhance-click", {
  type: "modifier",
  memoryCost: 1,
  status: "buyable",
  initialState: () => ({ subscribed: false, unsubscribe: () => {} }),
  onStatusChange: (next, prev, [state, setState]) => {
    if (next === "running" && !state().subscribed) {
      const unsubscribe = bus.subscribe("flip-bit", ({ infoDelta }) => {
        bits.add(infoDelta);
      });
      setState({ subscribed: true, unsubscribe });
    } else if (next === "inactive" && prev === "running") {
      state().unsubscribe();
      setState({ subscribed: false, unsubscribe: () => {} });
    }
  },
});

export const clickEnhancerCost = createBuyable({
  resource: data,
  cost: multiplicative(1, 1 * KB),
  limit: 1,
});
