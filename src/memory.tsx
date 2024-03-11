import { createSignal } from "solid-js";
import { data } from "./data";
import {
  applyUpgrades,
  createUpgrade,
  unlockOnResourceThreshold,
} from "./upgrade";
import { KB, additive, multiplicative } from "./utils";

interface Process {
  type: string;
  name: string;
  tickFn: (nextTime: Date, deltaTime: number) => void;
  memoryCost: number;
}
export const [runningProcs, setRunningProcs] = createSignal<Process[]>([]);

export const memory = () =>
  runningProcs().reduce((sum, p) => sum + p.memoryCost, 0);

export const maxMemoryUpgrade = createUpgrade({
  costResource: data,
  cost: multiplicative(2, 1 * KB),
  unlocks: unlockOnResourceThreshold(data, (cost) => cost(0)),
  effect: additive(1),
});

export const maxMemory = applyUpgrades(0, [maxMemoryUpgrade]);

export const utilization = () => memory() / maxMemory();
export const available = () => maxMemory() - memory();

export const enableProcess = (proc: Process): number => {
  setRunningProcs((p) => [...p, proc]);
  return runningProcs().length - 1;
};

export const disableProcess = (procId: number) => {
  setRunningProcs((p) => [...p.slice(0, procId), ...p.slice(procId + 1)]);
};

export const tick = (nextTime: Date, deltaTime: number) => {
  runningProcs().forEach((proc) => {
    proc.tickFn(nextTime, deltaTime);
  });
};
