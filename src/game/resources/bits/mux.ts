import { clamp } from "@core/utils";
import { createSignal } from "solid-js";
import { firstAvailableBit, nextBitRefresh } from "./calcs";

export const [lastMuxClick, setLastMuxClick] = createSignal(new Date(0));

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

export const bitMuxAvailable = (time: Date) => {
  return firstAvailableBit(time) !== -1;
};
