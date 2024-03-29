import { createSignal, Accessor, batch } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { Upgrade, UpgradeFn, applyUpgrades } from "@core/upgrade";
import { clamp } from "./utils";
import { bus } from "./events";

export interface Resource {
  name: string;
  current: Accessor<number>;
  baseMax: Accessor<number>;
  max: UpgradeFn;
  add: (n: number) => number;
  sub: (n: number) => number;
  set: (n: number) => number;
  setMax: (n: number) => void;
  applyUpgrade: (upgrade: Upgrade) => void;
}

export interface ResourceConfig {
  uncapped?: boolean;
  unfloored?: boolean;
}

export interface StatefulResource<T> extends Resource {
  get: (idx: number) => T;
  update: (idx: number, updaterFn: (draft: T) => void) => void;
  all: () => T[];
}

export interface StatefulResourceConfig<T> extends ResourceConfig {
  create: () => T;
}

export function createResource(
  name: string,
  initialValue: number,
  maxValue: number = Infinity,
  cfg: ResourceConfig = {}
): Resource {
  const [current, setCurrent] = createSignal(
    cfg.uncapped ? initialValue : Math.min(initialValue, maxValue)
  );
  const [baseMax, setBaseMax] = createSignal(maxValue);
  const [upgrades, setUpgrades] = createSignal<Upgrade[]>([]);
  const moddedMax: UpgradeFn = (n) => applyUpgrades(baseMax(), upgrades())(n);

  const changeCurrent = (n: number) => {
    const newValue = clamp(
      cfg.unfloored ? -Infinity : 0,
      cfg.uncapped ? Infinity : moddedMax(),
      n
    );
    if (newValue !== current()) {
      const prevValue = current();
      setCurrent(newValue);
      bus.emit("resource-change", {
        resourceName: name,
        delta: newValue - prevValue,
        newCurrent: newValue,
      });
    }
    return newValue;
  };

  return {
    name,
    current,
    baseMax: baseMax,
    max: moddedMax,

    add: (n) => changeCurrent(current() + n),
    sub: (n) => changeCurrent(current() - n),
    set: changeCurrent,
    setMax: setBaseMax,
    // TODO: do we actually want to apply upgrades like this?
    applyUpgrade: (upgrade) =>
      setUpgrades(
        produce((draft) => {
          draft.push(upgrade);
        })
      ),
  };
}

export function createStatefulResource<T>(
  name: string,
  initialValue: number,
  maxValue: number = Infinity,
  cfg: StatefulResourceConfig<T>
): StatefulResource<T> {
  const { create } = cfg;
  const baseResource = createResource(name, initialValue, maxValue, cfg);

  const initialState: T[] = [];
  for (let i = 0; i < baseResource.current(); i++) {
    initialState.push(create());
  }
  const [state, setState] = createStore<T[]>(initialState);

  const addStates = (toAdd: number) => {
    setState(
      produce((draft) => {
        for (let i = 0; i < toAdd; i++) {
          draft.push(create());
        }
      })
    );
  };
  const removeStates = (toRemove: number) => {
    setState(
      produce((draft) => {
        for (let i = 0; i < toRemove; i++) {
          draft.pop();
        }
      })
    );
  };
  return {
    ...baseResource,
    add: (n) =>
      batch(() => {
        const prev = baseResource.current();
        const next = baseResource.add(n);
        const toAdd = next - prev;
        addStates(toAdd);
        return next;
      }),
    sub: (n) =>
      batch(() => {
        const prev = baseResource.current();
        const next = baseResource.sub(n);
        const toRemove = prev - next;
        removeStates(toRemove);

        return next;
      }),
    set: (n) =>
      batch(() => {
        const prev = baseResource.current();
        const next = baseResource.set(n);
        const toAdd = next - prev;
        if (toAdd > 0) {
          addStates(toAdd);
        } else if (toAdd < 0) {
          removeStates(toAdd * -1);
        }

        return next;
      }),
    get: (i) => {
      return state[i];
    },
    update: (i, updaterFn) => {
      setState(
        produce((draft) => {
          updaterFn(draft[i]);
        })
      );
    },
    all: () => state,
  };
}
