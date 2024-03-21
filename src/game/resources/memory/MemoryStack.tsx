import { For, Index } from "solid-js";
import { routinesByStatus } from "./routines";
import { maxMemory } from "./upgrades";

export function MemoryStack() {
  const memorySlots = () => new Array(maxMemory() + 1);
  return (
    <div>
      <h3 class="text-xl">Memory</h3>
      <div class="flex flex-row items-center gap-2">
        <div
          class="w-40 bg-gray-700 flex flex-col-reverse"
          style={{ height: `${40 * maxMemory()}px` }}
        >
          <For each={routinesByStatus("running")}>
            {(proc) => (
              <div
                class="bg-slate-400"
                style={{ height: `${40 * proc.proc.memoryCost}px` }}
              >
                <div class="text-xs">{proc.proc.name}</div>
              </div>
            )}
          </For>
        </div>
        <div class="flex flex-col-reverse">
          <Index each={memorySlots()}>
            {(_, index) => <div class="h-10 leading-10">{index}</div>}
          </Index>
        </div>
      </div>
    </div>
  );
}
