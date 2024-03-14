import {
  Accessor,
  For,
  Setter,
  Show,
  batch,
  createEffect,
  createMemo,
  createSignal,
} from "solid-js";
import { produce } from "solid-js/store";
import { Button } from "./Button";
import { flipBitMux } from "./bit";
import { Buyable, createBuyable } from "./buyable";
import { data } from "./data";
import {
  Unlockable,
  createUnlockable,
  manualUnlock,
  unlockOnResourceThreshold,
  unlockOnSignalCondition,
} from "./unlockable";
import { applyUpgrades, createUpgrade } from "./upgrade";
import { KB, additive, currency, multiplicative } from "./utils";

export type ProcessStatus = "locked" | "buyable" | "inactive" | "running";

export interface Process<T> {
  type: string;
  name: string;
  tickFn: (newTime: Date, deltaTime: number) => void;
  memoryCost: number;
  state: Accessor<T>;
  status: Accessor<ProcessStatus>;
  setStatus: Setter<ProcessStatus>;
}

export interface ProcessConfig<T> {
  type: string;
  name: string;
  initialState: () => T;
  tick: (
    time: {
      newTime: Date;
      deltaTime: number;
    },
    state: T,
    setState: Setter<T>
  ) => void;
  memoryCost: number;
  status?: ProcessStatus;
}

export function createProcess<T>(cfg: ProcessConfig<T>): Process<T> {
  const [state, setState] = createSignal(cfg.initialState());
  const [status, setStatus] = createSignal(cfg.status ?? "locked");
  return {
    type: cfg.type,
    name: cfg.name,
    memoryCost: cfg.memoryCost,
    tickFn: (newTime, deltaTime) =>
      cfg.tick({ newTime, deltaTime }, state(), setState),
    state,
    status,
    setStatus,
  };
}

const currentMemory = () =>
  processesByStatus("running").reduce((sum, p) => sum + p.proc.memoryCost, 0);

export const maxMemoryUpgrade = createUpgrade({
  costResource: data,
  cost: multiplicative(2, 1 * KB),
  unlocks: (cost) => unlockOnResourceThreshold(data, cost(0)),
  effect: additive(1),
});

const maxMemory = applyUpgrades(0, [maxMemoryUpgrade]);

export const memory = {
  current: currentMemory,
  max: maxMemory,
};

export const utilization = () => currentMemory() / maxMemory();
export const available = () => maxMemory() - currentMemory();

export const autoFlipperCooldownUpgrade = createUpgrade({
  costResource: data,
  cost: multiplicative(1.15, 128),
  unlocks: manualUnlock(),
  effect: multiplicative(1 / 1.2),
});
export const autoFlipperCooldown = applyUpgrades(2000, [
  autoFlipperCooldownUpgrade,
]);

export const autoFlipperProcess = createProcess({
  type: "generator",
  name: "autoflip",
  initialState: () => ({ lastFlip: new Date(0) }),
  tick: ({ newTime }, state, setState) => {
    const cd = autoFlipperCooldown();
    const since = newTime.getTime() - state.lastFlip.getTime();
    if (since >= cd) {
      if (flipBitMux()) {
        setState(
          produce((draft) => {
            draft.lastFlip = newTime;
          })
        );
      }
    }
  },
  memoryCost: 1,
  status: "buyable",
});
const autoFlipperCost = createBuyable({
  resource: data,
  cost: multiplicative(1, 1 * KB),
  limit: 1,
});

export const processShopUnlock = createUnlockable(
  unlockOnSignalCondition(maxMemory, (v) => v > 0)
);

export interface ProcessEntry<T> {
  proc: Process<T>;
  cost: Buyable;
  unlock?: Unlockable;
}

export const allProcesses: ProcessEntry<unknown>[] = [
  {
    proc: autoFlipperProcess,
    cost: autoFlipperCost,
  },
];

export function tickProcesses(nextTime: Date, delta: number) {
  processesByStatus("running").forEach((p) => p.proc.tickFn(nextTime, delta));
}

export function initProcesses() {
  allProcesses.forEach((p) => {
    if (p.unlock) {
      p.unlock.init();
    }
  });
}

export function cleanupProcesses() {
  // allProcesses.forEach((p) => {
  //   if (p.unlock) {
  //     p.unlock.cleanup();
  //   }
  // });
}

export const processesByStatus = (status: ProcessStatus) =>
  allProcesses.filter((p) => p.proc.status() === status);

export function ProcessShop() {
  const buyableProcesses = createMemo(() => processesByStatus("buyable"));
  return (
    <>
      <Show when={processShopUnlock.unlocked()}>
        <h3 class="text-xl">Processes</h3>
        <For each={buyableProcesses()}>
          {(proc) => {
            const buy = () => {
              batch(() => {
                proc.cost.buy();
                proc.cost.resource.sub(proc.cost.cost());
                proc.proc.setStatus("inactive");
              });
            };
            return (
              <Show when={proc.cost.canBuy()}>
                <Button onClick={buy} disabled={!proc.cost.canAfford()}>
                  {proc.proc.name} ({currency(proc.cost.cost())})
                </Button>
              </Show>
            );
          }}
        </For>
        <For each={buyableProcesses()}>
          {(proc) => {
            return (
              <Show when={!proc.cost.canBuy()}>
                <Button disabled>{proc.proc.name} </Button>
              </Show>
            );
          }}
        </For>
      </Show>
    </>
  );
}

export function ProcessSwitchBoard() {
  const ownedProcesses = createMemo(() =>
    allProcesses.filter(
      (p) => p.proc.status() === "running" || p.proc.status() === "inactive"
    )
  );
  return (
    <>
      <Show when={maxMemoryUpgrade.unlocked()}>
        <h3 class="text-xl">Processes (owned)</h3>
        <For each={ownedProcesses()}>
          {(proc) => {
            const onClass = "bg-green-500 hover:enabled:bg-green-600";
            const offClass =
              "bg-red-300 text-gray-800 hover:enabled:bg-red-400";
            const procOn = createMemo(() => proc.proc.status() === "running");
            const toggle = () => {
              if (procOn()) {
                proc.proc.setStatus("inactive");
              } else {
                proc.proc.setStatus("running");
              }
            };
            return (
              <Button
                onClick={() => toggle()}
                disabled={!procOn() && available() < proc.proc.memoryCost}
                class={`${procOn() ? onClass : offClass}`}
              >
                {proc.proc.name} ({currency(proc.cost.cost())})
              </Button>
            );
          }}
        </For>
      </Show>
    </>
  );
}
