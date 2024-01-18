import { Accessor, For, Show, createSignal } from "solid-js";
import "./App.css";
import { createStore, produce } from "solid-js/store";

const BASE_VALUES = {
  informationDecayRatePerSecondPerPercentExceeded: 0.01,
  bitFlipCooldownMS: 1000,
  bitsPerFlip: 1,
  memoryPerFlipFlop: 2,
  clockTickSpeedMS: 10000,
  clockBitsPerTick: 1,
  clockCost: 8,
  clockCostAddedCostScalars: [0, 1, 2, 4, 6, 8],
  clockCostCostMultiplier: 2,
  clockCostCostMultiplierPerClock: 0.1,
};

const [state, setState] = createStore({
  information: {
    current: 0,
    max: 256,
    mods: {
      decayFactor: 1,
    },
    timers: {
      nextDecay: new Date(0),
    },
  },
  bits: {
    current: 1,
    _: [
      {
        lastFlip: new Date(0),
        automated: false,
      },
    ],
    mods: {
      cooldownMulti: 1,
      addedInformationPerClick: 0,
      informationMultiPerClick: 1,
    },
  },
  clocks: {
    count: 0,
    purchased: 0,
    mods: {
      tickSpeedMulti: 1,
      addedInfoPerTick: 0,
      infoPerTickMulti: 1,
    },
  },
  progress: {
    expandedMemoryUnlocked: false,
    clocksUnlocked: false,
  },
});

const interpolate = (color1: string, color2: string, t: number) => {
  // Convert the hex colors to RGB values
  const r1 = parseInt(color1.substring(1, 3), 16);
  const g1 = parseInt(color1.substring(3, 5), 16);
  const b1 = parseInt(color1.substring(5, 7), 16);

  const r2 = parseInt(color2.substring(1, 3), 16);
  const g2 = parseInt(color2.substring(3, 5), 16);
  const b2 = parseInt(color2.substring(5, 7), 16);

  // Interpolate the RGB values
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);

  // Convert the interpolated RGB values back to a hex color
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
};

const information = () => state.information.current;
const maxInformation = () => state.information.max;

const bits = () => state.bits.current;
const bitFlipCooldown = () =>
  BASE_VALUES.bitFlipCooldownMS * state.bits.mods.cooldownMulti;
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

const clockCost = () =>
  state.clocks.count >= BASE_VALUES.clockCostAddedCostScalars.length
    ? BASE_VALUES.clockCost *
    BASE_VALUES.clockCostCostMultiplier **
    (BASE_VALUES.clockCostCostMultiplierPerClock * state.clocks.count)
    : BASE_VALUES.clockCost +
    BASE_VALUES.clockCostAddedCostScalars[state.clocks.count];
// const decayInformation = (time: Date) => {
//   const exceededBy = information() - maxInformation();
//   if (exceededBy > 0) {
//     // TODO
//   }
// };

const clickBit = (bitIndex: number) =>
  setState(
    produce((draft) => {
      const now = new Date();
      const infoToAdd =
        (BASE_VALUES.bitsPerFlip + state.bits.mods.addedInformationPerClick) *
        state.bits.mods.informationMultiPerClick;
      const nextInfo = Math.min(maxInformation(), information() + infoToAdd);
      draft.bits._[bitIndex].lastFlip = now;
      if (information() <= maxInformation() && nextInfo > maxInformation()) {
        // TODO: initiate decay
      }
      draft.information.current = nextInfo;
      console.log(`flipping bit. new bits: ${draft.bits.current}`);

      // if (!draft.progress.clocksUnlocked && draft.bits.current >= clockCost()) {
      //   draft.progress.clocksUnlocked = true;
      // }
    })
  );

const clockTickTimeMS = () =>
  BASE_VALUES.clockTickSpeedMS * state.clocks.mods.tickSpeedMulti;

const clockInfoPerTick = () =>
  (BASE_VALUES.clockBitsPerTick + state.clocks.mods.addedInfoPerTick) *
  state.clocks.mods.infoPerTickMulti;

const tickClocks = (time: Date) =>
  setState(
    produce((draft) => {
      for (let i = 0; i < draft.bits._.length; i++) {
        const bit = draft.bits._[i];
        const timeSinceLastFlip = time.getTime() - bit.lastFlip.getTime();
        if (timeSinceLastFlip > clockTickTimeMS()) {
          draft.information.current += clockInfoPerTick();
          bit.lastFlip = time;
        }
      }
    })
  );

const buyClock = () =>
  setState(
    produce((draft) => {
      if (draft.bits.current >= clockCost()) {
        draft.clocks.count++;
        draft.clocks.purchased++;
        draft.bits.current -= clockCost();
      }
    })
  );

function App() {
  const [now, setNow] = createSignal(new Date());

  const step = () => {
    const nextNow = new Date();
    setNow(nextNow);
    if (state.progress.clocksUnlocked) {
      tickClocks(nextNow);
    }
    window.requestAnimationFrame(step);
  };

  window.requestAnimationFrame(step);

  return (
    <>
      <div class="card">
        <div>Current time: {now().toISOString()}</div>
        <BitGrid now={now} />
        <div>
          information:
          <span style={{}}>
            {state.information.current}/{state.information.max}
          </span>
        </div>
        <Show when={state.progress.clocksUnlocked} fallback={null}>
          <button onClick={buyClock} disabled={bits() < clockCost()}>
            clock ({clockCost()}b)
          </button>
          <div>
            clocks:
            <span style={{}}>{state.clocks.count}</span>
          </div>
        </Show>
      </div>
    </>
  );
}

function BitGrid(props: { now: Accessor<Date> }) {
  const { now } = props;
  return (
    <div>
      <For each={state.bits._}>
        {(_bit, i) => {
          const flippable = () => bitFlippable(i(), now());
          return (
            <button
              class="bit"
              style={{
                "background-color": interpolate(
                  "#cc3333",
                  "#ffffff",
                  bitFlipCooldownProgress(i(), now())
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
