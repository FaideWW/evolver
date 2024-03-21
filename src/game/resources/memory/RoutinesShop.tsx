import { Button } from "@components/Button";
import { For, Show, batch, createMemo } from "solid-js";
import { currency } from "@core/utils";
import { routinesUnlock, routinesByStatus } from "./routines";

export function RoutinesShop() {
  const buyableRoutines = createMemo(() => routinesByStatus("buyable"));
  return (
    <>
      <Show when={routinesUnlock.unlocked()}>
        <h3 class="text-xl">Routines</h3>
        <For each={buyableRoutines()}>
          {(routine) => {
            const buy = () => {
              batch(() => {
                routine.cost.buy();
                routine.cost.resource.sub(routine.cost.cost());
                routine.proc.setStatus("inactive");
              });
            };
            return (
              <Show when={routine.cost.canBuy()}>
                <Button onClick={buy} disabled={!routine.cost.canAfford()}>
                  {routine.proc.name} ({currency(routine.cost.cost())})
                </Button>
              </Show>
            );
          }}
        </For>
        <For each={buyableRoutines()}>
          {(routine) => {
            return (
              <Show when={!routine.cost.canBuy()}>
                <Button disabled>{routine.proc.name} </Button>
              </Show>
            );
          }}
        </For>
      </Show>
    </>
  );
}
