import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import { createStore, produce } from "solid-js/store";
import "./App.css";
import { bus } from "./events";
import { createResource, createStatefulResource } from "./resource";
import {
  applyUpgrades,
  createUpgrade,
  manualUnlock,
  unlockOnEvent,
} from "./upgrade";
import {
  UnitNotationOption,
  additive,
  clamp,
  cssInterpolate,
  displayCurrency,
  displayTime,
  multiplicative,
} from "./utils";

const BASE_VALUES = {
  bitCost: 8,
  bitCostCostMultiplier: 2,

  bitParallelFlips: 1,

  autoFlipperCooldownMS: 2000,
  autoFlipperBitsUnlockThreshold: 4,
  autoFlipperCost: 32,
};

const information = createResource(0, 256);
const maxInfoUpgrade = createUpgrade({
  costResource: information,
  cost: multiplicative(1.5, 128),
  unlocks: unlockOnEvent(
    "flip-bit",
    (cost) =>
      ({ newInfo }) =>
        newInfo >= cost(0)
  ),
  effect: multiplicative(1.5),
});

information.applyUpgrade(maxInfoUpgrade);

const bitParallelFlipUpgrade = createUpgrade({
  costResource: information,
  cost: multiplicative(1.15, 64),
  unlocks: unlockOnEvent(
    "flip-bit",
    (cost) =>
      ({ newInfo }) =>
        newInfo >= cost(0)
  ),
  effect: additive(1),
});
const bitParallelFlips = () => applyUpgrades(1, [bitParallelFlipUpgrade]);

const bitFlipCooldownUpgrade = createUpgrade({
  costResource: information,
  cost: multiplicative(1.2, 32),
  unlocks: unlockOnEvent(
    "buy-bit",
    () =>
      ({ newBitCount }) =>
        newBitCount >= 4
  ),
  effect: multiplicative(1 / 1.1),
});
const bitFlipCooldown = () => applyUpgrades(1000, [bitFlipCooldownUpgrade]);

const autoFlipperCooldownUpgrade = createUpgrade({
  costResource: information,
  cost: multiplicative(1.15, 128),
  unlocks: manualUnlock(),
  effect: multiplicative(1 / 1.2),
});
const autoFlipperCooldown = () =>
  applyUpgrades(2000, [autoFlipperCooldownUpgrade]);

const bitAddedInfoUpgrade = createUpgrade({
  costResource: information,
  cost: multiplicative(1.2, 32),
  unlocks: unlockOnEvent(
    "buy-bit",
    () =>
      ({ newBitCount }) =>
        newBitCount >= 4
  ),
  effect: additive(1),
});

const bitInfoPerFlip = () => applyUpgrades(1, [bitAddedInfoUpgrade]);

const [state, setState] = createStore({
  // bits: {
  //   purchased: 0,
  //   _: [
  //     {
  //       flips: [new Date(0)],
  //     },
  //   ],
  //   lastMuxClick: new Date(0),
  // },
  autoFlipper: {
    purchased: false,
    enabled: false,
    lastFlip: new Date(0),
  },
  progress: {
    moreBitsUnlocked: false,
    autoFlipperUnlocked: false,
  },
  settings: {
    infoUnitNotation: "Windows" as UnitNotationOption,
  },
});

const [lastMuxClick, setLastMuxClick] = createSignal(new Date(0));

const bits = createStatefulResource(1, Infinity, {
  uncapped: true,
  create: () => ({ flips: [new Date(0)] }),
});

// const bits = () => state.bits._.length;

const autoFlipperPurchased = () => state.autoFlipper.purchased;

const bitFlipCooldownProgress = (bitIndex: number, time: Date) =>
  bits
    .get(bitIndex)
    .flips.map((flip) =>
      clamp(0, 1, (time.getTime() - flip.getTime()) / bitFlipCooldown())
    );

const bitMuxCooldownProgress = (
  now: Date,
  lastClick: Date = lastMuxClick()
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
    Math.min(...bits.get(bitIndex).flips.map((flip) => flip.getTime())) +
      bitFlipCooldown()
  );

const bitFlippable = (bitIndex: number, time: Date) =>
  bitFlipCooldownProgress(bitIndex, time).some((prog) => prog >= 1) ||
  bits.get(bitIndex).flips.length < bitParallelFlipUpgrade.effect();

const bitCost = (n: number = bits.current()) =>
  Math.round(
    multiplicative(
      BASE_VALUES.bitCostCostMultiplier,
      BASE_VALUES.bitCost
    )(n - 1)
  );

const autoFlipperCost = () => BASE_VALUES.autoFlipperCost;

const nextBitRefresh = (time: Date = new Date()) => {
  let nextRefresh: Date | undefined = undefined;
  for (let i = 0; i < bits.current(); i++) {
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
  for (let i = 0; i < bits.current(); i++) {
    if (bitFlippable(i, time)) {
      return i;
    }
  }
  return -1;
};

const bitMuxAvailable = (time: Date) => {
  return firstAvailableBit(time) !== -1;
};

const buyBit = () => {
  if (information.current() >= bitCost()) {
    bits.add(1);
    information.sub(bitCost());
  }
  bus.emit("buy-bit", { newBitCount: bits.current() });
};

const flipBit = (bitIndex: number, time: Date = new Date()) => {
  const addedInfo = bitInfoPerFlip();
  bits.update(bitIndex, (bit) => {
    if (bit.flips.length === bitParallelFlips()) {
      bit.flips.shift();
    }

    bit.flips.push(time);
  });
  information.add(addedInfo);

  bus.emit("flip-bit", {
    infoDelta: addedInfo,
    newInfo: information.current(),
  });
};
// separated for tracking manual clicks vs. automated flips
const clickBit = (bitIndex: number, time: Date = new Date()) =>
  flipBit(bitIndex, time);

const buyAutoFlipper = () =>
  setState(
    produce((draft) => {
      if (information.current() >= autoFlipperCost()) {
        information.sub(autoFlipperCost());
        draft.autoFlipper.purchased = true;
        draft.autoFlipper.enabled = true;

        autoFlipperCooldownUpgrade.unlock();
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

  clickBit(nextBit, now);
  setLastMuxClick(now);
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
  maxInfoUpgrade.init();
  bitParallelFlipUpgrade.init();
  bitFlipCooldownUpgrade.init();
  bitAddedInfoUpgrade.init();

  bus.subscribe("flip-bit", (_, { unsubscribe }) => {
    console.log(`info: ${information.current()} - bitCost: ${bitCost()}`);
    if (information.current() >= bitCost()) {
      setState(
        produce((draft) => {
          draft.progress.moreBitsUnlocked = true;
        })
      );
      unsubscribe();
    }
  });

  bus.subscribe("buy-bit", (_, { unsubscribe }) => {
    if (bits.current() >= BASE_VALUES.autoFlipperBitsUnlockThreshold) {
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
            {currency(information.current())}/{currency(information.max())}
          </span>
        </div>
        <div id="purchases">
          <Show when={state.progress.moreBitsUnlocked} fallback={null}>
            <button
              onClick={buyBit}
              disabled={information.current() < bitCost()}
            >
              new bit ({currency(bitCost())})
            </button>
          </Show>
        </div>
        <div id="upgrades">
          <Show when={bitParallelFlipUpgrade.unlocked()} fallback={null}>
            <button
              onClick={() => bitParallelFlipUpgrade.buy()}
              disabled={information.current() < bitParallelFlipUpgrade.cost()}
            >
              <div>
                flips per bit ({currency(bitParallelFlipUpgrade.cost())})
              </div>
              <div>
                {bitParallelFlips()}
                {"->"}
                {BASE_VALUES.bitParallelFlips +
                  bitParallelFlipUpgrade.effect(
                    bitParallelFlipUpgrade.purchased() + 1
                  )}
              </div>
            </button>
          </Show>
          <Show when={maxInfoUpgrade.unlocked()} fallback={null}>
            <button
              onClick={() => maxInfoUpgrade.buy()}
              disabled={information.current() < maxInfoUpgrade.cost()}
            >
              <div>memory increase ({currency(maxInfoUpgrade.cost())})</div>
              <div>
                {currency(information.max())}
                {"->"}
                TODO: FIX ME {currency(information.max())}
              </div>
            </button>
          </Show>
          <Show when={bitFlipCooldownUpgrade.unlocked()} fallback={null}>
            <button
              onClick={() => bitFlipCooldownUpgrade.buy()}
              disabled={information.current() < bitFlipCooldownUpgrade.cost()}
            >
              <div>
                bit cooldown ({currency(bitFlipCooldownUpgrade.cost())})
              </div>
              <div>
                {displayTime(bitFlipCooldown())}
                {"->"}
                {displayTime(
                  1000 *
                    bitFlipCooldownUpgrade.effect(
                      bitFlipCooldownUpgrade.purchased() + 1
                    )
                )}
              </div>
            </button>
          </Show>
          <Show when={bitAddedInfoUpgrade.unlocked()} fallback={null}>
            <button
              onClick={() => bitAddedInfoUpgrade.buy()}
              disabled={information.current() < bitAddedInfoUpgrade.cost()}
            >
              <div>
                info per bitflip ({currency(bitAddedInfoUpgrade.cost())})
              </div>
              <div>
                {currency(bitInfoPerFlip())}
                {"->"}
                {currency(
                  1 +
                    bitAddedInfoUpgrade.effect(
                      bitAddedInfoUpgrade.purchased() + 1
                    )
                )}
              </div>
            </button>
          </Show>
          <Show when={autoFlipperCooldownUpgrade.unlocked()} fallback={null}>
            <button
              onClick={() => autoFlipperCooldownUpgrade.buy()}
              disabled={
                information.current() < autoFlipperCooldownUpgrade.cost()
              }
            >
              <div>
                autoflipper cooldown (
                {currency(autoFlipperCooldownUpgrade.cost())})
              </div>
              <div>
                {displayTime(autoFlipperCooldown())}
                {"->"}
                {displayTime(
                  BASE_VALUES.autoFlipperCooldownMS *
                    autoFlipperCooldownUpgrade.effect(
                      autoFlipperCooldownUpgrade.purchased() + 1
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
              information.current() < autoFlipperCost() ||
              autoFlipperPurchased()
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
    <div class={bits.current() >= 8 ? "bit-grid-fullrow" : "bit-grid-initial"}>
      <For each={bits.all()}>
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
