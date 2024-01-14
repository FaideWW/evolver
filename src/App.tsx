import { Show, batch, createSignal } from "solid-js";
import "./App.css";
import { createStore, produce } from "solid-js/store";

const BASE_VALUES = {
  bitFlipCooldownMS: 1000,
  bitsPerFlip: 1,
  bitsDecayRatePerSecondPerBitExceeded: 0.1,
  memoryPerFlipFlop: 2,
  flipFlopCost: 4,
  clockTickSpeedMS: 10000,
  clockBitsPerTick: 1,
  clockCost: 8,
  clockCostMultiplierPerClock: 1.2,
};

const [state, setState] = createStore({
  bits: {
    count: 0,
    flipped: 0,
    mods: {
      cooldownMulti: 1,
      addedBitsPerFlip: 0,
      bitsPerFlipMulti: 1,
      decayMulti: 1,
    },
    timers: {
      lastFlipped: new Date(0),
      lastDecay: new Date(0),
    },
  },
  flipFlops: {
    count: 0,
    purchased: 0,
    mods: {
      memoryMulti: 1,
    },
  },
  clocks: {
    count: 0,
    purchased: 0,
    mods: {
      tickSpeedMulti: 1,
      bitsPerTickMulti: 1,
    },
    timers: {
      lastTick: new Date(0),
    },
  },
  progress: {
    clocksUnlocked: false,
    flipflopUnlocked: false,
    bitDecayUnlocked: false,
  },
});

const bits = () => state.bits.count;

const bitFlipCooldown = () =>
  BASE_VALUES.bitFlipCooldownMS * state.bits.mods.cooldownMulti;
const maxBits = () =>
  state.flipFlops.count *
  (BASE_VALUES.memoryPerFlipFlop * state.flipFlops.mods.memoryMulti);

const clockCost = () => BASE_VALUES.clockCost;
const flipFlopCost = () => BASE_VALUES.flipFlopCost;

const decayBits = (time: Date) => {
  const exceededBy = bits() - maxBits();
  if (exceededBy > 0) {
    const timeSinceLastDecay =
      time.getTime() - state.bits.timers.lastDecay.getTime();
    const decayRate =
      BASE_VALUES.bitsDecayRatePerSecondPerBitExceeded *
      exceededBy *
      state.bits.mods.decayMulti;
    const timeToDecay = (1 / decayRate) * 1000;
    if (timeSinceLastDecay > timeToDecay) {
      setState(
        "bits",
        produce((draft) => {
          draft.count--;
          console.log(`decaying bit. new bits: ${draft.count}`);
          draft.timers.lastDecay = time;
        })
      );
    }
  }
};

const flipBit = () =>
  setState(
    produce((draft) => {
      const now = new Date();
      const addedBits =
        (BASE_VALUES.bitsPerFlip + state.bits.mods.addedBitsPerFlip) *
        state.bits.mods.bitsPerFlipMulti;
      const nextBits = draft.bits.count + addedBits;
      draft.bits.timers.lastFlipped = now;
      if (bits() <= maxBits() && nextBits > maxBits()) {
        console.log(`exceeded max bits. setting last decay to: ${now}`);
        draft.bits.timers.lastDecay = now;
      }
      draft.bits.count = nextBits;
      draft.bits.flipped += addedBits;
      console.log(`flipping bit. new bits: ${draft.bits.count}`);

      if (!draft.progress.clocksUnlocked && draft.bits.count >= clockCost()) {
        draft.progress.clocksUnlocked = true;
      }
    })
  );

const buyFlipFlop = () =>
  setState(
    produce((draft) => {
      if (draft.bits.count >= flipFlopCost()) {
        draft.flipFlops.count++;
        draft.bits.count -= flipFlopCost();
      }
    })
  );

const clockTickTime = () =>
  BASE_VALUES.clockTickSpeedMS * state.clocks.mods.tickSpeedMulti;

const clockBitsPerTick = () =>
  BASE_VALUES.clockBitsPerTick * state.clocks.mods.bitsPerTickMulti;

const tickClocks = (time: Date) =>
  setState(
    produce((draft) => {
      if (draft.clocks.count > 0) {
        const timeSinceLastTick =
          time.getTime() - draft.clocks.timers.lastTick.getTime();
        if (clockTickTime() < timeSinceLastTick) {
          const addedBits = draft.clocks.count * clockBitsPerTick();
          draft.bits.count += addedBits;
          draft.clocks.timers.lastTick = time;
        }
      }
    })
  );

const buyClock = () =>
  setState(
    produce((draft) => {
      if (draft.bits.count >= clockCost()) {
        draft.clocks.count++;
        draft.clocks.purchased++;
        draft.bits.count -= clockCost();
      }
    })
  );

function App() {
  const [now, setNow] = createSignal(new Date());

  const step = () => {
    const nextNow = new Date();
    setNow(nextNow);
    if (state.progress.bitDecayUnlocked) {
      decayBits(nextNow);
    }
    if (state.progress.clocksUnlocked) {
      tickClocks(nextNow);
    }
    window.requestAnimationFrame(step);
  };

  window.requestAnimationFrame(step);

  const bitFlipProgress = () =>
    Math.min(
      (now().getTime() - state.bits.timers.lastFlipped.getTime()) /
      bitFlipCooldown(),
      1
    );

  const automaticBitsPerSecond = () =>
    (state.clocks.count * clockBitsPerTick()) / (clockTickTime() / 1000);

  return (
    <>
      <div class="card">
        <div>Current time: {now().toISOString()}</div>
        <button
          style={{
            background: `linear-gradient(90deg, #ffffff ${bitFlipProgress() * 100
              }%, #9999ff ${bitFlipProgress() * 100}%)`,
          }}
          onClick={flipBit}
          disabled={bitFlipProgress() < 1}
        >
          flip bit
        </button>
        <div>
          bits flipped:
          <span style={{}}>{state.bits.count}</span>
          <Show when={state.clocks.count > 0} fallback={null}>
            <span style={{ color: "#339933" }}>
              (+{automaticBitsPerSecond().toFixed(1)}/s)
            </span>
          </Show>
        </div>
        <Show when={state.progress.clocksUnlocked} fallback={null}>
          <button onClick={buyClock} disabled={bits() < clockCost()}>
            synchronize clock ({clockCost()}b)
          </button>
        </Show>
        <Show when={state.progress.flipflopUnlocked} fallback={null}>
          <button onClick={buyFlipFlop} disabled={bits() < flipFlopCost()}>
            synthesize embedding ({flipFlopCost()}b)
          </button>
        </Show>
        <Show when={maxBits() > 0} fallback={null}>
          <div>memory: {maxBits()} bits</div>
        </Show>
      </div>
    </>
  );
}

export default App;
