import { Accessor, createEffect, createSignal } from "solid-js";
import { EventType, Events, bus } from "@core/events";
import { Resource } from "@core/resource";

export type UnlockType =
  | "on-event"
  | "resource-threshold"
  | "manual"
  | "on-signal-condition";

export interface UnlockFunctions {
  "on-event": (onUnlock: () => void) => void;
  "on-signal-condition": (onUnlock: () => void) => void;
  "resource-threshold": (onUnlock: () => void) => void;
  manual: () => void;
}

export interface UnlockCondition<T extends UnlockType> {
  type: UnlockType;
  fn: UnlockFunctions[T];
}

export function unlockOnEvent<T extends EventType>(
  eventType: T,
  fn: (event: Events[T]) => boolean
): UnlockCondition<"on-event"> {
  return {
    type: "on-event",
    fn: (onUnlock: () => void) => {
      bus.subscribe(eventType, (e, { unsubscribe }) => {
        const result = fn(e);
        if (result) {
          onUnlock();
          unsubscribe();
        }
      });
    },
  };
}

export function manualUnlock(): UnlockCondition<"manual"> {
  return { type: "manual", fn: () => {} };
}

export function unlockOnResourceThreshold(
  resource: Resource,
  threshold: number | (() => number)
): UnlockCondition<"resource-threshold"> {
  return {
    type: "resource-threshold",
    fn: (onUnlock) => {
      createEffect(() => {
        const value = typeof threshold === "function" ? threshold() : threshold;
        if (resource.current() >= value) {
          onUnlock();
        }
      });
    },
  };
}

export function unlockOnSignalCondition<T>(
  signal: Accessor<T>,
  condFn: (value: T) => boolean
): UnlockCondition<"on-signal-condition"> {
  return {
    type: "on-signal-condition",
    fn: (onUnlock) => {
      console.log("cond init");
      createEffect(() => {
        console.log("effect running", signal());
        if (condFn(signal())) {
          console.log("unlock");
          onUnlock();
        }
      });
    },
  };
}

export interface Unlockable {
  name: string;
  init: () => void;
  unlock: () => void;
  unlocked: Accessor<boolean>;
}

export function createUnlockable<T extends UnlockType>(
  name: string,
  cfg: UnlockCondition<T>
) {
  const [unlocked, setUnlocked] = createSignal(false);
  const changeUnlocked = (nextValue: boolean) => {
    setUnlocked(nextValue);
    bus.emit("unlock", { unlockName: name });
  };
  return {
    name,
    init: () => {
      switch (cfg.type) {
        case "on-event":
          {
            (cfg as UnlockCondition<"on-event">).fn(() => changeUnlocked(true));
          }
          break;
        case "resource-threshold":
          {
            (cfg as UnlockCondition<"resource-threshold">).fn(() =>
              changeUnlocked(true)
            );
          }
          break;
        case "on-signal-condition":
          {
            (cfg as UnlockCondition<"on-signal-condition">).fn(() =>
              changeUnlocked(true)
            );
          }
          break;
      }
    },
    unlocked,
    unlock: () => changeUnlocked(true),
  };
}
