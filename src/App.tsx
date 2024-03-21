import { Button } from "@components/Button";
import { cssInterpolate, currency, displayTime } from "@core/utils";
import { clickBit, flipBitMux } from "@resources/bits/actions";
import { bitCost, bits } from "@resources/bits/base";
import {
  bitFlipCooldown,
  bitFlipCooldownProgress,
  bitFlippable,
  bitInfoPerFlip,
  bitParallelFlips,
  bitsFlipped,
} from "@resources/bits/calcs";
import { bitMuxAvailable, bitMuxCooldownProgress } from "@resources/bits/mux";
import {
  bitFlipAddedInfoUpgrade,
  bitFlipCooldownUpgrade,
  bitParallelFlipUpgrade,
  bitsFlippedUpgrade,
} from "@resources/bits/upgrades";
import { data } from "@resources/data/base";
import { maxDataUpgrade } from "@resources/data/upgrades";
import { MemoryStack } from "@resources/memory/MemoryStack";
import { RoutinesShop } from "@resources/memory/RoutinesShop";
import { RoutineSwitchBoard } from "@resources/memory/RoutinesSwitchboard";
import {
  cleanupRoutines,
  initRoutines,
  routinesUnlock,
  tickRoutines,
} from "@resources/memory/routines";
import { maxMemoryUpgrade } from "@resources/memory/upgrades";
import { For, Show, createSignal, onCleanup, onMount } from "solid-js";
import colors from "tailwindcss/colors";

function initialize() {
  initRoutines();

  maxDataUpgrade.init();
  maxMemoryUpgrade.init();
  bitParallelFlipUpgrade.init();
  bitFlipCooldownUpgrade.init();
  bitsFlippedUpgrade.init();
  bitFlipAddedInfoUpgrade.init();
  routinesUnlock.init();
}

function cleanup() {
  // maxDataUpgrade.cleanup();
  // maxMemoryUpgrade.cleanup();
  // bitParallelFlipUpgrade.cleanup();
  // bitFlipCooldownUpgrade.cleanup();
  // bitsFlippedUpgrade.cleanup();
  // bitFlipAddedInfoUpgrade.cleanup();

  cleanupRoutines();
}

function tick(next: Date, delta: number) {
  tickRoutines(next, delta);
}

function App() {
  const [now, setNow] = createSignal(new Date());
  let raf: number;

  onMount(initialize);
  onCleanup(cleanup);

  const step = () => {
    const nextNow = new Date();
    tick(nextNow, nextNow.getTime() - now().getTime());
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
            <Show when={routinesUnlock.unlocked()}>
              <MemoryStack />
              <RoutineSwitchBoard />
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
        <div id="processes" class="">
          <RoutinesShop />
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

function Purchases() {
  return (
    <>
      <Show when={data.current() >= bitCost.cost() || bits.current() > 1}>
        <Button
          onClick={() => bitCost.buy()}
          disabled={data.current() < bitCost.cost()}
        >
          new bit ({currency(bitCost.cost())})
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
        <h3 class="text-xl my-8">Upgrades</h3>
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
    </>
  );
}

function Unlocks() {
  return null;
  // return (
  //   <>
  //     <Show when={state.progress.autoFlipperUnlocked}>
  //       <Button
  //         onClick={buyAutoFlipper}
  //         disabled={
  //           data.current() < autoFlipperCost() || autoFlipperPurchased()
  //         }
  //       >
  //         auto flipper ({currency(autoFlipperCost())})
  //       </Button>
  //     </Show>
  //   </>
  // );
}

export default App;
