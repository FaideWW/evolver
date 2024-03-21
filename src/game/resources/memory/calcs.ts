import { routinesByStatus } from "./routines";
import { maxMemory } from "./upgrades";

const currentMemory = () =>
  routinesByStatus("running").reduce((sum, p) => sum + p.proc.memoryCost, 0);

export const utilization = () => currentMemory() / maxMemory();
export const available = () => maxMemory() - currentMemory();
