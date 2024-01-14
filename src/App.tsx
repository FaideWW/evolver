import { Show, createSignal } from "solid-js";
import "./App.css";
import { createStore, produce } from "solid-js/store";

const BASE_VALUES = {
  bitFlipCooldownMS: 1000,
  bitsPerFlip: 1,
  maxBits: 0,
  bitsDecayRatePerSecondPerBitExceeded: 0.1,
};

const ANIMATION_TIMERS = {
  bitFlipGlow: 1,
  bitDecayGlow: 1,
};

const [state, setState] = createStore({
  bits: {
    count: 0,
    mods: {
      cdr: 1,
      addedBitsPerFlip: 0,
      bitsPerFlipMulti: 1,
      decayMulti: 1,
      addedMaxBits: 0,
      maxBitsMulti: 1,
    },
    timers: {
      lastFlipped: new Date(0),
      lastDecay: new Date(0),
    },
  },
  progress: {
    flipflopUnlocked: false,
  },
});

const bits = () => state.bits.count;

const bitFlipCooldown = () =>
  BASE_VALUES.bitFlipCooldownMS * state.bits.mods.cdr;
const maxBits = () =>
  (BASE_VALUES.maxBits + state.bits.mods.addedMaxBits) *
  state.bits.mods.maxBitsMulti;

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
      console.log(`flipping bit. new bits: ${draft.bits.count}`);

      if (!draft.progress.flipflopUnlocked) {
        draft.progress.flipflopUnlocked = true;
      }
    })
  );

function App() {
  const [now, setNow] = createSignal(new Date());

  const step = () => {
    const nextNow = new Date();
    setNow(nextNow);
    decayBits(nextNow);
    window.requestAnimationFrame(step);
  };

  window.requestAnimationFrame(step);

  const bitFlipProgress = () =>
    Math.min(
      (now().getTime() - state.bits.timers.lastFlipped.getTime()) /
      bitFlipCooldown(),
      1
    );

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
        </div>
        <Show fallback={null}></Show>
      </div>
    </>
  );
}

export default App;
