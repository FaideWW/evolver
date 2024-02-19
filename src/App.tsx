import { For, Show, createSignal, onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";
import "./App.css";
import {
  UnitNotationOption,
  displayCurrency,
  displayTime,
  interpolate,
} from "./utils";

interface ParallelProcessor {
  lastFlip: Date;
}

const BASE_VALUES = {
  maxInformation: 256,
  informationDecayRatePerSecondPerPercentExceeded: 0.01,
  bitFlipCooldownMS: 1000,
  informationPerBitFlip: 1,
  memoryPerFlipFlop: 2,
  clockTickSpeedMS: 10000,
  clockBitsPerTick: 1,
  bitCost: 8,
  bitCostCostMultiplier: 2,
  bitMuxCost: 64,
  bitMuxUnlockBitCount: 4,

  parallelProcBitsUnlockThreshold: 4,
  parallelProcCost: 32,
  parallelProcCostMultiPerPurchased: 1.5,
  parallelProcCooldownMS: 2000,

  bitCooldownUpgradeBitsUnlockThreshold: 4,
  bitCooldownUpgradeCost: 32,
  bitCooldownUpgradeCostMultiplierPerPurchased: 1.2,
  bitCooldownMultiPerUpgrade: 1.1,

  bitAddedInfoUpgradeBitsUnlockThreshold: 4,
  bitAddedInfoUpgradeCost: 32,
  bitAddedInfoUpgradeCostMultiplierPerPurchased: 1.2,
  bitAddedInfoPerUpgrade: 0.1,

  bitInfoMultiUpgradeBitsUnlockThreshold: 64,
  bitInfoMultiUpgradeCost: 256,
  bitInfoMultiUpgradeCostMultiplierPerPurchased: 4,
  bitInfoMultiPerUpgrade: 2,

  maxInfoUpgradeInfoUnlockThreshold: 256,
  maxInfoUpgradeCost: 128,
  maxInfoUpgradeCostMultiplierPerPurchased: 1.5,
  maxInfoMultiPerUpgrade: 1.5,

  ppCooldownUpgradeCost: 128,
  ppCooldownUpgradeCostMultiplierPerPurchased: 2,
  ppCooldownMultiPerUpgrade: 1.1,
};

const [state, setState] = createStore({
  information: {
    current: 0,
    mods: {
      decayFactor: 1,
    },
    timers: {
      nextDecay: new Date(0),
    },
    purchasedUpgrades: {
      maxMultiplier: 0,
    },
  },
  bits: {
    purchased: 0,
    _: [
      {
        lastFlip: new Date(0),
      },
    ],
    purchasedUpgrades: {
      cooldownMultiplier: 0,
      addedInformation: 0,
      informationMulti: 0,
    },
  },
  parallelProcs: {
    purchased: 0,
    _: [] as ParallelProcessor[],
    purchasedUpgrades: {
      cooldownMultiplier: 0,
    },
  },
  unlocks: {
    bitMux: false,
  },
  progress: {
    expandedMemoryUnlocked: false,
    clocksUnlocked: false,
    moreBitsUnlocked: false,
    bitMuxUnlocked: false,
    parallelProcsUnlocked: false,
    bitCooldownUpgradeUnlocked: false,
    bitAddedInfoUpgradeUnlocked: false,
    bitInfoMultiplierUpgradeUnlocked: false,
    maxInformationUpgradeUnlocked: false,
    ppCooldownUpgradeUnlocked: false,
  },
  settings: {
    infoUnitNotation: "Windows" as UnitNotationOption,
  },
});

const information = () => state.information.current;
const maxInformation = (
  n: number = state.information.purchasedUpgrades.maxMultiplier
) => BASE_VALUES.maxInformation * BASE_VALUES.bitInfoMultiPerUpgrade ** n;

const bits = () => state.bits._.length;
const parallelProcs = () => state.parallelProcs._.length;

const bitFlipCooldown = (
  n: number = state.bits.purchasedUpgrades.cooldownMultiplier
) =>
  BASE_VALUES.bitFlipCooldownMS *
  (1 / BASE_VALUES.bitCooldownMultiPerUpgrade ** n);

const parallelProcCooldown = (
  n: number = state.parallelProcs.purchasedUpgrades.cooldownMultiplier
) =>
  BASE_VALUES.parallelProcCooldownMS *
  (1 / BASE_VALUES.ppCooldownMultiPerUpgrade ** n);

const bitInfoPerFlip = (
  m: number = state.bits.purchasedUpgrades.addedInformation,
  n: number = state.bits.purchasedUpgrades.informationMulti
) =>
  (BASE_VALUES.informationPerBitFlip + BASE_VALUES.bitAddedInfoPerUpgrade * m) *
  (1 * BASE_VALUES.bitInfoMultiPerUpgrade ** n);

const bitFlipCooldownProgress = (bitIndex: number, time: Date) =>
  Math.max(
    0,
    Math.min(
      1,
      (time.getTime() - state.bits._[bitIndex].lastFlip.getTime()) /
        bitFlipCooldown()
    )
  );
const bitFlippable = (bitIndex: number, time: Date) =>
  bitFlipCooldownProgress(bitIndex, time) >= 1;

const bitCost = (n: number = state.bits.purchased) =>
  Math.round(BASE_VALUES.bitCost * BASE_VALUES.bitCostCostMultiplier ** n);

const parallelProcCost = (n: number = state.parallelProcs.purchased) =>
  Math.round(
    BASE_VALUES.parallelProcCost *
      BASE_VALUES.parallelProcCostMultiPerPurchased ** n
  );

const bitCooldownUpgradeCost = (
  n: number = state.bits.purchasedUpgrades.cooldownMultiplier
) =>
  Math.round(
    BASE_VALUES.bitCooldownUpgradeCost *
      BASE_VALUES.bitCooldownUpgradeCostMultiplierPerPurchased ** n
  );

const bitAddedInfoUpgradeCost = (
  n: number = state.bits.purchasedUpgrades.addedInformation
) =>
  Math.round(
    BASE_VALUES.bitAddedInfoUpgradeCost *
      BASE_VALUES.bitAddedInfoUpgradeCostMultiplierPerPurchased ** n
  );

const maxInfoUpgradeCost = (
  n: number = state.information.purchasedUpgrades.maxMultiplier
) =>
  Math.round(
    BASE_VALUES.maxInfoUpgradeCost *
      BASE_VALUES.maxInfoUpgradeCostMultiplierPerPurchased ** n
  );

const ppCooldownUpgradeCost = (
  n: number = state.parallelProcs.purchasedUpgrades.cooldownMultiplier
) =>
  Math.round(
    BASE_VALUES.ppCooldownUpgradeCost *
      BASE_VALUES.ppCooldownUpgradeCostMultiplierPerPurchased ** n
  );

const bitMuxCost = () => Math.round(BASE_VALUES.bitMuxCost);

const nextAvailableBit = (time: Date) => {
  // bit mux is available if any bit is available
  for (let i = 0; i < state.bits._.length; i++) {
    if (bitFlippable(i, time)) {
      return i;
    }
  }
  return -1;
};

const bitMuxAvailable = (time: Date) => {
  return nextAvailableBit(time) !== -1;
};

const buyBit = () =>
  setState(
    produce((draft) => {
      if (information() >= bitCost()) {
        draft.bits._.push({
          lastFlip: new Date(0),
        });
        draft.information.current -= bitCost();
        draft.bits.purchased++;

        if (
          !draft.progress.bitMuxUnlocked &&
          bits() >= BASE_VALUES.bitMuxUnlockBitCount
        ) {
          draft.progress.bitMuxUnlocked = true;
        }

        if (
          !draft.progress.bitCooldownUpgradeUnlocked &&
          bits() >= BASE_VALUES.bitCooldownUpgradeBitsUnlockThreshold
        ) {
          draft.progress.bitCooldownUpgradeUnlocked = true;
        }

        if (
          !draft.progress.bitAddedInfoUpgradeUnlocked &&
          bits() >= BASE_VALUES.bitAddedInfoUpgradeBitsUnlockThreshold
        ) {
          draft.progress.bitAddedInfoUpgradeUnlocked = true;
        }

        if (
          !draft.progress.bitInfoMultiplierUpgradeUnlocked &&
          bits() >= BASE_VALUES.bitInfoMultiUpgradeBitsUnlockThreshold
        ) {
          draft.progress.bitInfoMultiplierUpgradeUnlocked = true;
        }
        if (
          !draft.progress.parallelProcsUnlocked &&
          bits() >= BASE_VALUES.parallelProcBitsUnlockThreshold
        ) {
          draft.progress.parallelProcsUnlocked = true;
        }
      }
    })
  );

const flipBit = (bitIndex: number, time: Date = new Date()) =>
  setState(
    produce((draft) => {
      const nextInfo = Math.min(
        maxInformation(),
        information() + bitInfoPerFlip()
      );
      draft.bits._[bitIndex].lastFlip = time;
      if (information() <= maxInformation() && nextInfo > maxInformation()) {
        // TODO: initiate decay
      }
      draft.information.current = nextInfo;

      if (!draft.progress.moreBitsUnlocked && information() >= bitCost()) {
        draft.progress.moreBitsUnlocked = true;
      }

      if (
        !draft.progress.maxInformationUpgradeUnlocked &&
        information() >= maxInfoUpgradeCost(0)
      ) {
        draft.progress.maxInformationUpgradeUnlocked = true;
      }
    })
  );

// separated for tracking manual clicks vs. automated flips
const clickBit = (bitIndex: number, time: Date = new Date()) =>
  flipBit(bitIndex, time);

const buyBitMux = () =>
  setState(
    produce((draft) => {
      if (draft.information.current >= bitMuxCost()) {
        draft.unlocks.bitMux = true;
        draft.information.current -= bitMuxCost();
      }
    })
  );

const buyParallelProc = () =>
  setState(
    produce((draft) => {
      if (information() > parallelProcCost()) {
        draft.information.current -= parallelProcCost();
        draft.parallelProcs._.push({
          lastFlip: new Date(0),
        });
        draft.parallelProcs.purchased++;

        if (!draft.progress.ppCooldownUpgradeUnlocked) {
          draft.progress.ppCooldownUpgradeUnlocked = true;
        }
      }
    })
  );

const buyBitCooldownUpgrade = () =>
  setState(
    produce((draft) => {
      if (information() >= bitCooldownUpgradeCost()) {
        draft.information.current -= bitCooldownUpgradeCost();
        draft.bits.purchasedUpgrades.cooldownMultiplier++;
      }
    })
  );

const buyBitAddedInfoUpgrade = () =>
  setState(
    produce((draft) => {
      if (information() >= bitAddedInfoUpgradeCost()) {
        draft.information.current -= bitAddedInfoUpgradeCost();
        draft.bits.purchasedUpgrades.addedInformation++;
      }
    })
  );

const buyMaxInfoUpgrade = () =>
  setState(
    produce((draft) => {
      if (information() >= maxInfoUpgradeCost()) {
        draft.information.current -= maxInfoUpgradeCost();
        draft.information.purchasedUpgrades.maxMultiplier++;
      }
    })
  );

const buyPPCooldownUpgrade = () =>
  setState(
    produce((draft) => {
      if (information() >= ppCooldownUpgradeCost()) {
        draft.information.current -= ppCooldownUpgradeCost();
        draft.parallelProcs.purchasedUpgrades.cooldownMultiplier++;
      }
    })
  );

const flipBitMux = () => {
  const now = new Date();
  // find any available bit and flip it
  const nextBit = nextAvailableBit(now);

  if (nextBit === -1) {
    return false;
  }

  clickBit(nextBit, now);
  return true;
};

const tick = (next: Date) => {
  setState(
    produce((draft) => {
      const cd = parallelProcCooldown();
      for (let i = 0; i < parallelProcs(); i++) {
        const since =
          next.getTime() - draft.parallelProcs._[i].lastFlip.getTime();
        if (since >= cd) {
          if (flipBitMux()) {
            draft.parallelProcs._[i].lastFlip = next;
          }
        }
      }
    })
  );
};

const currency = (n: number) =>
  displayCurrency(n, state.settings.infoUnitNotation);

function App() {
  const [now, setNow] = createSignal(new Date());
  let raf: number;

  const step = () => {
    const nextNow = new Date();
    tick(nextNow);
    setNow(nextNow);
    raf = window.requestAnimationFrame(step);
  };

  raf = window.requestAnimationFrame(step);

  onCleanup(() => window.cancelAnimationFrame(raf));

  return (
    <>
      <div class="card">
        <div>Current time: {now().toISOString()}</div>
        <Show when={state.unlocks.bitMux}>
          <button onClick={flipBitMux} disabled={!bitMuxAvailable(now())}>
            flip bit
          </button>
        </Show>
        <BitGrid now={now()} />
        <div id="game-state">
          information:
          <span style={{}}>
            {currency(information())}/{currency(maxInformation())}
          </span>
        </div>
        <div id="purchases">
          <Show when={state.progress.moreBitsUnlocked} fallback={null}>
            <button onClick={buyBit} disabled={information() < bitCost()}>
              new bit ({currency(bitCost())})
            </button>
          </Show>
          <Show when={state.progress.parallelProcsUnlocked} fallback={null}>
            <button
              onClick={buyParallelProc}
              disabled={information() < parallelProcCost()}
            >
              new auto flipper ({currency(parallelProcCost())})
            </button>
          </Show>
        </div>
        <div id="upgrades">
          <Show
            when={state.progress.maxInformationUpgradeUnlocked}
            fallback={null}
          >
            <button
              onClick={buyMaxInfoUpgrade}
              disabled={information() < maxInfoUpgradeCost()}
            >
              <div>memory increase ({currency(maxInfoUpgradeCost())})</div>
              <div>
                {currency(maxInformation())}
                {"->"}
                {currency(
                  maxInformation(
                    state.information.purchasedUpgrades.maxMultiplier + 1
                  )
                )}
              </div>
            </button>
          </Show>
          <Show
            when={state.progress.bitCooldownUpgradeUnlocked}
            fallback={null}
          >
            <button
              onClick={buyBitCooldownUpgrade}
              disabled={information() < bitCooldownUpgradeCost()}
            >
              <div>bit cooldown ({currency(bitCooldownUpgradeCost())})</div>
              <div>
                {displayTime(bitFlipCooldown())}
                {"->"}
                {displayTime(
                  bitFlipCooldown(
                    state.bits.purchasedUpgrades.cooldownMultiplier + 1
                  )
                )}
              </div>
            </button>
          </Show>
          <Show
            when={state.progress.bitAddedInfoUpgradeUnlocked}
            fallback={null}
          >
            <button
              onClick={buyBitAddedInfoUpgrade}
              disabled={information() < bitAddedInfoUpgradeCost()}
            >
              <div>
                info per bitflip ({currency(bitAddedInfoUpgradeCost())})
              </div>
              <div>
                {currency(bitInfoPerFlip())}
                {"->"}
                {currency(
                  bitInfoPerFlip(
                    state.bits.purchasedUpgrades.addedInformation + 1
                  )
                )}
              </div>
            </button>
          </Show>
          <Show when={state.progress.ppCooldownUpgradeUnlocked} fallback={null}>
            <button
              onClick={buyPPCooldownUpgrade}
              disabled={information() < ppCooldownUpgradeCost()}
            >
              <div>
                autoflipper cooldown ({currency(ppCooldownUpgradeCost())})
              </div>
              <div>
                {displayTime(parallelProcCooldown())}
                {"->"}
                {displayTime(
                  parallelProcCooldown(
                    state.parallelProcs.purchasedUpgrades.cooldownMultiplier + 1
                  )
                )}
              </div>
            </button>
          </Show>
        </div>
        <div id="unlocks">
          <Show when={state.progress.bitMuxUnlocked} fallback={null}>
            <button
              onClick={buyBitMux}
              disabled={
                state.unlocks.bitMux || information() < BASE_VALUES.bitMuxCost
              }
            >
              multiplexer ({currency(BASE_VALUES.bitMuxCost)})
            </button>
          </Show>
        </div>
      </div>
    </>
  );
}

function BitGrid(props: { now: Date }) {
  return (
    <div class={bits() >= 8 ? "bit-grid-fullrow" : "bit-grid-initial"}>
      <For each={state.bits._}>
        {(_bit, i) => {
          const flippable = () => bitFlippable(i(), props.now);
          return (
            <button
              class="bit"
              style={{
                "background-color": interpolate(
                  "#cc3333",
                  "#ffffff",
                  bitFlipCooldownProgress(i(), props.now)
                ),
              }}
              disabled={!flippable()}
              onClick={() => clickBit(i())}
            />
          );
        }}
      </For>
    </div>
  );
}

export default App;
