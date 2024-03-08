import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import { createStore, produce } from "solid-js/store";
import "./App.css";
import {
  UnitNotationOption,
  addedScale,
  clamp,
  cssInterpolate,
  displayCurrency,
  displayTime,
  doubleScale,
  multiScale,
} from "./utils";
import { bus } from "./events";

const BASE_VALUES = {
  maxInformation: 256,
  informationDecayRatePerSecondPerPercentExceeded: 0.01,
  bitFlipCooldownMS: 1000,
  informationPerBitFlip: 1,
  bitCost: 8,
  bitCostCostMultiplier: 2,
  bitMuxCost: 64,
  bitMuxUnlockBitCount: 4,

  bitParallelFlips: 1,
  bitParallelFlipCost: 64,
  bitParallelFlipCostMultiPerPurchased: 1.15,
  bitParallelFlipAddedFlipsPerUpgrade: 1,

  autoFlipperCooldownMS: 2000,
  autoFlipperBitsUnlockThreshold: 4,
  autoFlipperCost: 32,

  bitCooldownUpgradeBitsUnlockThreshold: 4,
  bitCooldownUpgradeCost: 32,
  bitCooldownUpgradeCostMultiplierPerPurchased: 1.2,
  bitCooldownMultiPerUpgrade: 1.1,

  bitAddedInfoUpgradeBitsUnlockThreshold: 4,
  bitAddedInfoUpgradeCost: 32,
  bitAddedInfoUpgradeCostMultiplierPerPurchased: 1.2,
  bitAddedInfoPerUpgrade: 1,

  bitInfoMultiUpgradeBitsUnlockThreshold: 64,
  bitInfoMultiUpgradeCost: 256,
  bitInfoMultiUpgradeCostMultiplierPerPurchased: 4,
  bitInfoMultiPerUpgrade: 2,

  maxInfoUpgradeInfoUnlockThreshold: 256,
  maxInfoUpgradeCost: 128,
  maxInfoUpgradeCostMultiplierPerPurchased: 1.5,
  maxInfoMultiPerUpgrade: 1.5,

  autoFlipperCooldownUpgradeCost: 128,
  autoFlipperCooldownUpgradeCostMultiplierPerPurchased: 1.15,
  autoFlipperCooldownMultiPerUpgrade: 1.2,
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
        flips: [new Date(0)],
      },
    ],
    lastMuxClick: new Date(0),
    purchasedUpgrades: {
      cooldownMultiplier: 0,
      addedInformation: 0,
      informationMulti: 0,
      parallelFlips: 0,
    },
  },
  autoFlipper: {
    purchased: false,
    enabled: false,
    lastFlip: new Date(0),
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
    bitParallelFlipsUnlocked: false,
    autoFlipperUnlocked: false,
    bitCooldownUpgradeUnlocked: false,
    bitAddedInfoUpgradeUnlocked: false,
    bitInfoMultiplierUpgradeUnlocked: false,
    maxInformationUpgradeUnlocked: false,
    autoFlipperCooldownUpgradeUnlocked: false,
  },
  settings: {
    infoUnitNotation: "Windows" as UnitNotationOption,
  },
});

const information = () => state.information.current;
const maxInformation = (
  n: number = state.information.purchasedUpgrades.maxMultiplier
) =>
  multiScale(BASE_VALUES.maxInformation, BASE_VALUES.maxInfoMultiPerUpgrade)(n);

const bits = () => state.bits._.length;
const bitParallelFlips = (
  n: number = state.bits.purchasedUpgrades.parallelFlips
) =>
  addedScale(
    BASE_VALUES.bitParallelFlips,
    BASE_VALUES.bitParallelFlipAddedFlipsPerUpgrade
  )(n);

const bitFlipCooldown = (
  n: number = state.bits.purchasedUpgrades.cooldownMultiplier
) =>
  multiScale(
    BASE_VALUES.bitFlipCooldownMS,
    1 / BASE_VALUES.bitCooldownMultiPerUpgrade
  )(n);

const autoFlipperPurchased = () => state.autoFlipper.purchased;
const autoFlipperCooldown = (
  n: number = state.autoFlipper.purchasedUpgrades.cooldownMultiplier
) =>
  multiScale(
    BASE_VALUES.autoFlipperCooldownMS,
    1 / BASE_VALUES.autoFlipperCooldownMultiPerUpgrade
  )(n);

const bitInfoPerFlip = (
  m: number = state.bits.purchasedUpgrades.addedInformation,
  n: number = state.bits.purchasedUpgrades.informationMulti
) =>
  doubleScale(
    BASE_VALUES.informationPerBitFlip,
    BASE_VALUES.bitAddedInfoPerUpgrade,
    BASE_VALUES.bitInfoMultiPerUpgrade
  )(m, n);

const bitFlipCooldownProgress = (bitIndex: number, time: Date) =>
  state.bits._[bitIndex].flips.map((flip) =>
    clamp(0, 1, (time.getTime() - flip.getTime()) / bitFlipCooldown())
  );

const bitMuxCooldownProgress = (
  now: Date,
  lastClick: Date = state.bits.lastMuxClick
) => {
  const nextRefresh = nextBitRefresh(now);
  return clamp(
    0,
    1,
    (now.getTime() - lastClick.getTime()) /
      (nextRefresh.getTime() - lastClick.getTime())
  );
};

const bitAvailableAt = (bitIndex: number) =>
  new Date(
    Math.min(...state.bits._[bitIndex].flips.map((flip) => flip.getTime())) +
      bitFlipCooldown()
  );

const bitFlippable = (bitIndex: number, time: Date) =>
  bitFlipCooldownProgress(bitIndex, time).some((prog) => prog >= 1) ||
  state.bits._[bitIndex].flips.length < bitParallelFlips();

const bitCost = (n: number = state.bits.purchased) =>
  Math.round(
    multiScale(BASE_VALUES.bitCost, BASE_VALUES.bitCostCostMultiplier)(n)
  );

const autoFlipperCost = () => BASE_VALUES.autoFlipperCost;

const bitCooldownUpgradeCost = (
  n: number = state.bits.purchasedUpgrades.cooldownMultiplier
) =>
  Math.round(
    multiScale(
      BASE_VALUES.bitCooldownUpgradeCost,
      BASE_VALUES.bitCooldownUpgradeCostMultiplierPerPurchased
    )(n)
  );

const bitAddedInfoUpgradeCost = (
  n: number = state.bits.purchasedUpgrades.addedInformation
) =>
  Math.round(
    multiScale(
      BASE_VALUES.bitAddedInfoUpgradeCost,
      BASE_VALUES.bitAddedInfoUpgradeCostMultiplierPerPurchased
    )(n)
  );

const maxInfoUpgradeCost = (
  n: number = state.information.purchasedUpgrades.maxMultiplier
) =>
  Math.round(
    multiScale(
      BASE_VALUES.maxInfoUpgradeCost,
      BASE_VALUES.maxInfoUpgradeCostMultiplierPerPurchased
    )(n)
  );

const autoFlipperCooldownUpgradeCost = (
  n: number = state.autoFlipper.purchasedUpgrades.cooldownMultiplier
) =>
  Math.round(
    multiScale(
      BASE_VALUES.autoFlipperCooldownUpgradeCost,
      BASE_VALUES.autoFlipperCooldownUpgradeCostMultiplierPerPurchased
    )(n)
  );

const bitParallelFlipCost = (
  n: number = state.bits.purchasedUpgrades.parallelFlips
) =>
  Math.round(
    multiScale(
      BASE_VALUES.bitParallelFlipCost,
      BASE_VALUES.bitParallelFlipCostMultiPerPurchased
    )(n)
  );

const nextBitRefresh = (time: Date = new Date()) => {
  let nextRefresh: Date | undefined = undefined;
  for (let i = 0; i < state.bits._.length; i++) {
    if (bitFlippable(i, time)) {
      return time;
    } else {
      const refreshAt = bitAvailableAt(i);
      if (nextRefresh === undefined || nextRefresh > refreshAt) {
        nextRefresh = refreshAt;
      }
    }
  }
  return nextRefresh as Date;
};

const firstAvailableBit = (time: Date) => {
  // bit mux is available if any bit is available
  for (let i = 0; i < state.bits._.length; i++) {
    if (bitFlippable(i, time)) {
      return i;
    }
  }
  return -1;
};

const bitMuxAvailable = (time: Date) => {
  return firstAvailableBit(time) !== -1;
};

const buyBit = () =>
  setState(
    produce((draft) => {
      if (information() >= bitCost()) {
        draft.bits._.push({
          flips: [new Date(0)],
        });
        draft.information.current -= bitCost();
        draft.bits.purchased++;
      }
      bus.emit("buy-bit", { newBitCount: draft.bits._.length });
    })
  );

const flipBit = (bitIndex: number, time: Date = new Date()) =>
  setState(
    produce((draft) => {
      const addedInfo = bitInfoPerFlip();
      const nextInfo = Math.min(maxInformation(), information() + addedInfo);
      if (draft.bits._[bitIndex].flips.length === bitParallelFlips()) {
        draft.bits._[bitIndex].flips.shift();
      }

      draft.bits._[bitIndex].flips.push(time);
      draft.information.current = nextInfo;

      if (information() <= maxInformation() && nextInfo > maxInformation()) {
        // TODO: initiate decay
      }

      bus.emit("flip-bit", { infoDelta: addedInfo, newInfo: nextInfo });
    })
  );

// separated for tracking manual clicks vs. automated flips
const clickBit = (bitIndex: number, time: Date = new Date()) =>
  flipBit(bitIndex, time);

const buyAutoFlipper = () =>
  setState(
    produce((draft) => {
      if (information() >= autoFlipperCost()) {
        draft.information.current -= autoFlipperCost();
        draft.autoFlipper.purchased = true;
        draft.autoFlipper.enabled = true;

        if (!draft.progress.autoFlipperCooldownUpgradeUnlocked) {
          draft.progress.autoFlipperCooldownUpgradeUnlocked = true;
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

const buyAutoFlipperCooldownUpgrade = () =>
  setState(
    produce((draft) => {
      if (information() >= autoFlipperCooldownUpgradeCost()) {
        draft.information.current -= autoFlipperCooldownUpgradeCost();
        draft.autoFlipper.purchasedUpgrades.cooldownMultiplier++;
      }
    })
  );

const buyBitParallelFlip = () =>
  setState(
    produce((draft) => {
      if (information() >= bitParallelFlipCost()) {
        draft.information.current -= bitParallelFlipCost();
        draft.bits.purchasedUpgrades.parallelFlips++;
      }
    })
  );

const flipBitMux = () => {
  const now = new Date();
  // find any available bit and flip it
  const nextBit = firstAvailableBit(now);

  if (nextBit === -1) {
    return false;
  }

  setState(
    produce((draft) => {
      clickBit(nextBit, now);
      draft.bits.lastMuxClick = now;
    })
  );
  return true;
};

const tick = (next: Date) => {
  setState(
    produce((draft) => {
      const cd = autoFlipperCooldown();
      const since = next.getTime() - draft.autoFlipper.lastFlip.getTime();
      if (since >= cd && draft.autoFlipper.enabled) {
        if (flipBitMux()) {
          draft.autoFlipper.lastFlip = next;
        }
      }
    })
  );
};

const currency = (n: number) =>
  displayCurrency(n, state.settings.infoUnitNotation);

function initialize() {
  bus.subscribe("flip-bit", (_, { unsubscribe }) => {
    if (information() >= bitCost()) {
      setState(
        produce((draft) => {
          draft.progress.moreBitsUnlocked = true;
        })
      );
      unsubscribe();
    }
  });

  bus.subscribe("flip-bit", (_, { unsubscribe }) => {
    if (information() >= maxInfoUpgradeCost(0)) {
      setState(
        produce((draft) => {
          draft.progress.maxInformationUpgradeUnlocked = true;
        })
      );
      unsubscribe();
    }
  });

  bus.subscribe("flip-bit", (_, { unsubscribe }) => {
    if (information() >= maxInfoUpgradeCost(0)) {
      setState(
        produce((draft) => {
          draft.progress.maxInformationUpgradeUnlocked = true;
        })
      );
      unsubscribe();
    }
  });

  bus.subscribe("flip-bit", (_, { unsubscribe }) => {
    if (information() >= bitParallelFlipCost(0)) {
      setState(
        produce((draft) => {
          draft.progress.bitParallelFlipsUnlocked = true;
        })
      );
      unsubscribe();
    }
  });

  bus.subscribe("buy-bit", (_, { unsubscribe }) => {
    if (bits() >= BASE_VALUES.bitMuxUnlockBitCount) {
      setState(
        produce((draft) => {
          draft.progress.bitMuxUnlocked = true;
        })
      );
      unsubscribe();
    }
  });

  bus.subscribe("buy-bit", (_, { unsubscribe }) => {
    if (bits() >= BASE_VALUES.bitCooldownUpgradeBitsUnlockThreshold) {
      setState(
        produce((draft) => {
          draft.progress.bitCooldownUpgradeUnlocked = true;
        })
      );
      unsubscribe();
    }
  });

  bus.subscribe("buy-bit", (_, { unsubscribe }) => {
    if (bits() >= BASE_VALUES.bitAddedInfoUpgradeBitsUnlockThreshold) {
      setState(
        produce((draft) => {
          draft.progress.bitAddedInfoUpgradeUnlocked = true;
        })
      );
      unsubscribe();
    }
  });

  bus.subscribe("buy-bit", (_, { unsubscribe }) => {
    if (bits() >= BASE_VALUES.bitInfoMultiUpgradeBitsUnlockThreshold) {
      setState(
        produce((draft) => {
          draft.progress.bitInfoMultiplierUpgradeUnlocked = true;
        })
      );
      unsubscribe();
    }
  });

  bus.subscribe("buy-bit", (_, { unsubscribe }) => {
    if (bits() >= BASE_VALUES.autoFlipperBitsUnlockThreshold) {
      setState(
        produce((draft) => {
          draft.progress.autoFlipperUnlocked = true;
        })
      );
      unsubscribe();
    }
  });
}

function App() {
  const [now, setNow] = createSignal(new Date());
  let raf: number;

  onMount(initialize);

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
        <button
          onClick={flipBitMux}
          disabled={!bitMuxAvailable(now())}
          class="bit-mux"
        >
          flip bit
          <div
            class="progress"
            style={{ width: `${(1 - bitMuxCooldownProgress(now())) * 100}%` }}
          />
        </button>
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
        </div>
        <div id="upgrades">
          <Show when={state.progress.bitParallelFlipsUnlocked} fallback={null}>
            <button
              onClick={buyBitParallelFlip}
              disabled={information() < bitParallelFlipCost()}
            >
              <div>flips per bit ({currency(bitParallelFlipCost())})</div>
              <div>
                {bitParallelFlips()}
                {"->"}
                {bitParallelFlips(
                  state.bits.purchasedUpgrades.parallelFlips + 1
                )}
              </div>
            </button>
          </Show>
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
          <Show
            when={state.progress.autoFlipperCooldownUpgradeUnlocked}
            fallback={null}
          >
            <button
              onClick={buyAutoFlipperCooldownUpgrade}
              disabled={information() < autoFlipperCooldownUpgradeCost()}
            >
              <div>
                autoflipper cooldown (
                {currency(autoFlipperCooldownUpgradeCost())})
              </div>
              <div>
                {displayTime(autoFlipperCooldown())}
                {"->"}
                {displayTime(
                  autoFlipperCooldown(
                    state.autoFlipper.purchasedUpgrades.cooldownMultiplier + 1
                  )
                )}
              </div>
            </button>
          </Show>
        </div>
        <div id="unlocks" />
        <Show when={state.progress.autoFlipperUnlocked} fallback={null}>
          <button
            onClick={buyAutoFlipper}
            disabled={
              information() < autoFlipperCost() || autoFlipperPurchased()
            }
          >
            auto flipper ({currency(autoFlipperCost())})
          </button>
        </Show>
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
                "background-color": cssInterpolate(
                  "#cc3333",
                  "#ffffff",
                  Math.min(...bitFlipCooldownProgress(i(), props.now))
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
