import { bus } from "@core/events";
import { data } from "@resources/data/base";
import {
  bitInfoPerFlip,
  bitParallelFlips,
  bitsFlipped,
  firstAvailableBit,
} from "./calcs";
import { setLastMuxClick } from "./mux";
import { bits } from "./base";

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
