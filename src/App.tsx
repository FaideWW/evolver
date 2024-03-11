import {
  For,
  Index,
  Show,
  createEffect,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import colors from "tailwindcss/colors";
import { Button } from "./Button";
import { bus } from "./events";
import { data, maxDataUpgrade } from "./data";
import { createResource, createStatefulResource } from "./resource";
import {
  applyUpgrades,
  createUpgrade,
  manualUnlock,
  unlockOnEvent,
  unlockOnResourceThreshold,
} from "./upgrade";
import {
  KB,
  UnitNotationOption,
  additive,
  clamp,
  cssInterpolate,
  displayCurrency,
  displayTime,
  multiplicative,
} from "./utils";
import { disableProcess, enableProcess, runningProcs } from "./memory";

const BASE_VALUES = {
  autoFlipperCooldownMS: 2000,
  autoFlipperBitsUnlockThreshold: 4,
  autoFlipperCost: 32,
};

const bits = createStatefulResource(1, Infinity, {
  uncapped: true,
  create: () => ({ flips: [new Date(0)] }),
});

// TODO: find an elegant way to integrate these
const bitCost = (p = bits.current(), c = 1) =>
  multiplicative(2, 8)(p - 1 + c - 1);
const buyBit = (n: number = 1) => {
  const cost = bitCost(bits.current() - 1 + (n - 1));
  if (data.current() >= cost) {
    data.sub(cost);
    bits.add(n);
    bus.emit("buy-bit", { newBitCount: bits.current() });
  }
};

const memory = createResource(0, 0);
const maxMemoryUpgrade = createUpgrade({
  costResource: data,
  cost: multiplicative(2, 1 * KB),
  unlocks: unlockOnResourceThreshold(data, (cost) => cost(0)),
  effect: additive(1),
});
memory.applyUpgrade(maxMemoryUpgrade);

const bitParallelFlipUpgrade = createUpgrade({
  costResource: data,
  cost: multiplicative(1.15, 64),
  unlocks: unlockOnResourceThreshold(data, (cost) => cost(0)),
  effect: additive(1),
});
const bitParallelFlips = applyUpgrades(1, [bitParallelFlipUpgrade]);

const bitFlipCooldownUpgrade = createUpgrade({
  costResource: data,
  cost: multiplicative(1.2, 32),
  unlocks: unlockOnResourceThreshold(bits, 4),
  effect: multiplicative(1 / 1.1),
});
const bitFlipCooldown = applyUpgrades(1000, [bitFlipCooldownUpgrade]);

const autoFlipperCooldownUpgrade = createUpgrade({
  costResource: data,
  cost: multiplicative(1.15, 128),
  unlocks: manualUnlock(),
  effect: multiplicative(1 / 1.2),
});
const autoFlipperCooldown = applyUpgrades(2000, [autoFlipperCooldownUpgrade]);

const bitsFlippedUpgrade = createUpgrade({
  costResource: data,
  cost: multiplicative(1.15, 64),
  unlocks: unlockOnEvent("buy-autoflipper", () => () => true),
  effect: additive(1),
});
const bitsFlipped = applyUpgrades(1, [bitsFlippedUpgrade]);

const bitFlipAddedInfoUpgrade = createUpgrade({
  costResource: data,
  cost: multiplicative(1.2, 32),
  unlocks: unlockOnResourceThreshold(bits, 4),
  effect: additive(1),
});

const bitInfoPerFlip = applyUpgrades(1, [bitFlipAddedInfoUpgrade]);

const [state, setState] = createStore({
  autoFlipper: {
    purchased: false,
    enabled: false,
    lastFlip: new Date(0),
  },
  progress: {
    autoFlipperUnlocked: false,
  },
  settings: {
    infoUnitNotation: "Windows" as UnitNotationOption,
  },
});

const [lastMuxClick, setLastMuxClick] = createSignal(new Date(0));

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

const flipBit = (bitIndex: number, time: Date = new Date()) => {
  const addedInfo = bitInfoPerFlip();
  bits.update(bitIndex, (bit) => {
    if (bit.flips.length === bitParallelFlips()) {
      bit.flips.shift();
    }

    bit.flips.push(time);
  });
  data.add(addedInfo);

  bus.emit("flip-bit", {
    infoDelta: addedInfo,
    newInfo: data.current(),
  });
};
// separated for tracking manual clicks vs. automated flips
const clickBit = (bitIndex: number, time: Date = new Date()) =>
  flipBit(bitIndex, time);

const buyAutoFlipper = () => {
  setState(
    produce((draft) => {
      if (data.current() >= autoFlipperCost()) {
        data.sub(autoFlipperCost());
        draft.autoFlipper.purchased = true;
        draft.autoFlipper.enabled = true;

        autoFlipperCooldownUpgrade.unlock();
      }
    })
  );
  bus.emit("buy-autoflipper", {});
};

const flipBitMux = () => {
  const now = new Date();
  for (let i = 0; i < bitsFlipped(); i++) {
    // find any available bit and flip it
    const nextBit = firstAvailableBit(now);

    if (nextBit === -1) {
      return false;
    }

    clickBit(nextBit, now);
  }
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

const [testProcId, setTestProcId] = createSignal(-1);

function initialize() {
  maxDataUpgrade.init();
  maxMemoryUpgrade.init();
  bitParallelFlipUpgrade.init();
  bitFlipCooldownUpgrade.init();
  bitsFlippedUpgrade.init();
  bitFlipAddedInfoUpgrade.init();

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

  setTestProcId(
    enableProcess({
      type: "",
      name: "Test process",
      tickFn: () => {},
      memoryCost: 0.5,
    })
  );
}

function cleanup() {
  // maxDataUpgrade.cleanup();
  // maxMemoryUpgrade.cleanup();
  // bitParallelFlipUpgrade.cleanup();
  // bitFlipCooldownUpgrade.cleanup();
  // bitsFlippedUpgrade.cleanup();
  // bitFlipAddedInfoUpgrade.cleanup();

  disableProcess(testProcId());
  setTestProcId(-1);
}

function App() {
  const [now, setNow] = createSignal(new Date());
  let raf: number;

  onMount(initialize);
  onCleanup(cleanup);

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
      <div class="container mx-auto my-8">
        <div class="flex flex-row items-start">
          <Button
            onClick={flipBitMux}
            disabled={!bitMuxAvailable(now())}
            class="relative overflow-hidden disabled:cursor-wait"
          >
            flip bit
            <div
              class="absolute top-0 right-0 bg-neutral-300 w-0 h-full opacity-50"
              style={{
                width: `${(1 - bitMuxCooldownProgress(now())) * 100}%`,
              }}
            />
          </Button>
          <div class="grow flex flex-col justify-center">
            <BitGrid now={now()} />
            <Show when={memory.max() > 0}>
              <MemoryStack />
            </Show>
          </div>
          <div id="game-state">
            data:
            <span style={{}}>
              {currency(data.current())}/{currency(data.max())}
            </span>
          </div>
        </div>
        <div id="purchases" class="">
          <Purchases />
        </div>
        <div id="upgrades" class="">
          <Upgrades />
        </div>
        <div id="unlocks">
          <Unlocks />
        </div>
      </div>
      <div id="cheat-menu" class="absolute bottom-4 right-4">
        <h3 class="text-xl bold">Cheats</h3>
        <Button
          onClick={() => {
            data.set(data.max());
          }}
        >
          max data ({currency(data.max())})
        </Button>
        <Button
          onClick={() => {
            bits.add(bits.current() < 8 ? 7 : 8);
          }}
        >
          add row of bits
        </Button>
        <Button
          onClick={() => {
            maxDataUpgrade.buy(4, true);
          }}
        >
          up max info ({currency(data.max(4))})
        </Button>
      </div>
    </>
  );
}

function BitGrid(props: { now: Date }) {
  const partialGrid = "flex flex-row justify-center";
  const fullGrid = "inline-grid w-96 mx-auto grid-cols-8 place-content-center";
  return (
    <div class={bits.current() < 8 ? partialGrid : fullGrid}>
      <For each={bits.all()}>
        {(_bit, i) => {
          const flippable = () => bitFlippable(i(), props.now);
          return (
            <button
              class="aspect-square w-12 bg-gray-950 border border-gray-700"
              style={{
                "background-color": cssInterpolate(
                  colors.red[500],
                  colors.gray[950],
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

function MemoryStack() {
  const memorySlots = () => new Array(memory.max() + 1);
  return (
    <div>
      <h3 class="text-xl">Memory</h3>
      <div class="flex flex-row items-center gap-2">
        <div
          class="w-40 bg-gray-600 flex flex-col-reverse"
          style={{ height: `${40 * memory.max()}px` }}
        >
          <For each={runningProcs()}>
            {(proc) => (
              <div
                class="bg-slate-400"
                style={{ height: `${40 * proc.memoryCost}px` }}
              >
                <div class="text-xs">{proc.name}</div>
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

function Purchases() {
  createEffect(() => {
    console.log(maxMemoryUpgrade.cost(0));
    console.log(maxMemoryUpgrade.unlocked());
  });
  return (
    <>
      <Show when={data.current() >= bitCost() || bits.current() > 1}>
        <Button onClick={() => buyBit()} disabled={data.current() < bitCost()}>
          new bit ({currency(bitCost())})
        </Button>
      </Show>
      <Show when={maxMemoryUpgrade.unlocked()}>
        <Button
          onClick={() => maxMemoryUpgrade.buy()}
          disabled={data.current() < maxMemoryUpgrade.cost()}
        >
          increase memory ({currency(maxMemoryUpgrade.cost())})
        </Button>
      </Show>
    </>
  );
}

function Upgrades() {
  return (
    <>
      <Show when={bitParallelFlipUpgrade.unlocked()}>
        <Button
          onClick={() => bitParallelFlipUpgrade.buy()}
          disabled={data.current() < bitParallelFlipUpgrade.cost()}
        >
          <div>flips per bit ({currency(bitParallelFlipUpgrade.cost())})</div>
          <div>
            {bitParallelFlips()}
            {"->"}
            {bitParallelFlips(1)}
          </div>
        </Button>
      </Show>
      <Show when={maxDataUpgrade.unlocked()}>
        <Button
          onClick={() => maxDataUpgrade.buy()}
          disabled={data.current() < maxDataUpgrade.cost()}
        >
          <div>max info increase ({currency(maxDataUpgrade.cost())})</div>
          <div>
            {currency(data.max())}
            {"->"}
            {currency(data.max(1))}
          </div>
        </Button>
      </Show>
      <Show when={bitFlipCooldownUpgrade.unlocked()}>
        <Button
          onClick={() => bitFlipCooldownUpgrade.buy()}
          disabled={data.current() < bitFlipCooldownUpgrade.cost()}
        >
          <div>bit cooldown ({currency(bitFlipCooldownUpgrade.cost())})</div>
          <div>
            {displayTime(bitFlipCooldown())}
            {"->"}
            {displayTime(bitFlipCooldown(1))}
          </div>
        </Button>
      </Show>
      <Show when={bitFlipAddedInfoUpgrade.unlocked()}>
        <Button
          onClick={() => bitFlipAddedInfoUpgrade.buy()}
          disabled={data.current() < bitFlipAddedInfoUpgrade.cost()}
        >
          <div>
            info per bitflip ({currency(bitFlipAddedInfoUpgrade.cost())})
          </div>
          <div>
            {currency(bitInfoPerFlip())}
            {"->"}
            {currency(bitInfoPerFlip(1))}
          </div>
        </Button>
      </Show>
      <Show when={bitsFlippedUpgrade.unlocked()}>
        <Button
          onClick={() => bitsFlippedUpgrade.buy()}
          disabled={data.current() < bitsFlippedUpgrade.cost()}
        >
          <div>bits flipped ({currency(bitsFlippedUpgrade.cost())})</div>
          <div>
            {bitsFlipped()}
            {"->"}
            {bitsFlipped(1)}
          </div>
        </Button>
      </Show>
      <Show when={autoFlipperCooldownUpgrade.unlocked()}>
        <Button
          onClick={() => autoFlipperCooldownUpgrade.buy()}
          disabled={data.current() < autoFlipperCooldownUpgrade.cost()}
        >
          <div>
            autoflipper cooldown ({currency(autoFlipperCooldownUpgrade.cost())})
          </div>
          <div>
            {displayTime(autoFlipperCooldown())}
            {"->"}
            {displayTime(autoFlipperCooldown(1))}
          </div>
        </Button>
      </Show>
    </>
  );
}

function Unlocks() {
  return (
    <>
      <Show when={state.progress.autoFlipperUnlocked}>
        <Button
          onClick={buyAutoFlipper}
          disabled={
            data.current() < autoFlipperCost() || autoFlipperPurchased()
          }
        >
          auto flipper ({currency(autoFlipperCost())})
        </Button>
      </Show>
    </>
  );
}

export default App;
