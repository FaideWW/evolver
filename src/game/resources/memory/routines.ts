import { Buyable } from "@core/buyable";
import { Routine, RoutineStatus } from "@core/routines";
import {
  Unlockable,
  createUnlockable,
  unlockOnSignalCondition,
} from "@core/unlockable";
import { autoFlipperCost, autoFlipperRoutine } from "./autoflipper";
import { clickEnhancer, clickEnhancerCost } from "./clickenhancer";
import { maxMemory } from "./upgrades";

export interface RoutineEntry<T> {
  proc: Routine<T>;
  cost: Buyable;
  unlock?: Unlockable;
}

export const routinesUnlock = createUnlockable(
  "routine-shop",
  unlockOnSignalCondition(maxMemory, (v) => v > 0)
);

export const allRoutines: RoutineEntry<unknown>[] = [
  {
    proc: autoFlipperRoutine,
    cost: autoFlipperCost,
  },
  {
    proc: clickEnhancer,
    cost: clickEnhancerCost,
  },
];

export const routinesByStatus = (status: RoutineStatus) =>
  allRoutines.filter((p) => p.proc.status() === status);

export function tickRoutines(nextTime: Date, delta: number) {
  routinesByStatus("running").forEach((r) => r.proc.tickFn(nextTime, delta));
}

export function initRoutines() {
  allRoutines.forEach((p) => {
    if (p.unlock) {
      p.unlock.init();
    }
  });
}

export function cleanupRoutines() {
  // allRoutines.forEach((p) => {
  //   if (p.unlock) {
  //     p.unlock.cleanup();
  //   }
  // });
}
