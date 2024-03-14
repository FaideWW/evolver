import { For, Index, Show, createSignal, onCleanup, onMount } from "solid-js";
import colors from "tailwindcss/colors";
import { Button } from "./Button";
import {
  bitCost,
  bitFlipAddedInfoUpgrade,
  bitFlipCooldown,
  bitFlipCooldownProgress,
  bitFlipCooldownUpgrade,
  bitFlippable,
  bitInfoPerFlip,
  bitMuxAvailable,
  bitMuxCooldownProgress,
  bitParallelFlipUpgrade,
  bitParallelFlips,
  bits,
  bitsFlipped,
  bitsFlippedUpgrade,
  buyBit,
  clickBit,
  flipBitMux,
} from "./bit";
import { data, maxDataUpgrade } from "./data";
import {
  ProcessShop,
  ProcessSwitchBoard,
  cleanupProcesses,
  initProcesses,
  maxMemoryUpgrade,
  memory,
  processShopUnlock,
  processesByStatus,
  tickProcesses,
} from "./memory";
import { cssInterpolate, currency, displayTime } from "./utils";

function initialize() {
  initProcesses();

  maxDataUpgrade.init();
  maxMemoryUpgrade.init();
  bitParallelFlipUpgrade.init();
  bitFlipCooldownUpgrade.init();
  bitsFlippedUpgrade.init();
  bitFlipAddedInfoUpgrade.init();
  processShopUnlock.init();
}

function cleanup() {
  // maxDataUpgrade.cleanup();
  // maxMemoryUpgrade.cleanup();
  // bitParallelFlipUpgrade.cleanup();
  // bitFlipCooldownUpgrade.cleanup();
  // bitsFlippedUpgrade.cleanup();
  // bitFlipAddedInfoUpgrade.cleanup();

  cleanupProcesses();
}

function tick(next: Date, delta: number) {
  tickProcesses(next, delta);
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
            <Show when={memory.max() > 0}>
              <MemoryStack />
              <ProcessSwitchBoard />
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
          <ProcessShop />
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
          class="w-40 bg-gray-700 flex flex-col-reverse"
          style={{ height: `${40 * memory.max()}px` }}
        >
          <For each={processesByStatus("running")}>
            {(proc) => (
              <div
                class="bg-slate-400"
                style={{ height: `${40 * proc.proc.memoryCost}px` }}
              >
                <div class="text-xs">{proc.proc.name}</div>
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
