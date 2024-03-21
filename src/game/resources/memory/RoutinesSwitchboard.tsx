import { For, Show, createMemo } from "solid-js";
import { Button } from "@components/Button";
import { currency } from "@core/utils";
import { available } from "./calcs";
import { allRoutines } from "./routines";
import { maxMemoryUpgrade } from "./upgrades";

export function RoutineSwitchBoard() {
  const ownedRoutines = createMemo(() =>
    allRoutines.filter(
      (r) => r.proc.status() === "running" || r.proc.status() === "inactive"
    )
  );
  return (
    <>
      <Show when={maxMemoryUpgrade.unlocked() && ownedRoutines().length > 0}>
        <h3 class="text-xl">Routines (owned)</h3>
        <For each={ownedRoutines()}>
          {(routine) => {
            const onClass = "bg-green-500 hover:enabled:bg-green-600";
            const offClass =
              "bg-red-300 text-gray-800 hover:enabled:bg-red-400";
            const procOn = createMemo(
              () => routine.proc.status() === "running"
            );
            const toggle = () => {
              if (procOn()) {
                routine.proc.setStatus("inactive");
              } else {
                routine.proc.setStatus("running");
              }
            };
            return (
              <Button
                onClick={() => toggle()}
                disabled={!procOn() && available() < routine.proc.memoryCost}
                class={`${procOn() ? onClass : offClass}`}
              >
                {routine.proc.name} ({currency(routine.cost.cost())})
              </Button>
            );
          }}
        </For>
      </Show>
    </>
  );
}
