import { onCleanup } from "solid-js";

export interface FlipBitEvent {
  infoDelta: number;
  newInfo: number;
}

export interface BuyBitEvent {
  newBitCount: number;
}

export interface Events {
  "flip-bit": FlipBitEvent;
  "buy-bit": BuyBitEvent;
}

export type EventType = keyof Events;

export interface ListenerArgs {
  unsubscribe: () => void;
}

export type Listener<T extends EventType> = (
  e: Events[T],
  opts: ListenerArgs
) => void;

export interface ListenerOptions {
  once?: boolean;
}

type ListenerEntry<T extends EventType> = {
  id: number;
  listener: Listener<T>;
  opts: ListenerOptions;
};

class EventBus {
  private listeners: { [T in EventType]?: Record<string, ListenerEntry<T>> } =
    {};
  private nextId: number = 0;
  constructor() {}

  subscribe<T extends EventType>(
    type: T,
    fn: Listener<T>,
    opts: ListenerOptions = {}
  ): () => void {
    if (!this.listeners[type]) {
      this.listeners[type] = {};
    }

    const listeners = this.listeners[type] as Record<string, ListenerEntry<T>>;
    const listenerId = this.nextId++;

    listeners[listenerId] = { id: listenerId, listener: fn, opts };

    console.log("registering listener", listenerId);

    const cleanup = () => {
      console.log("cleaning up listener", listenerId);
      delete this.listeners[type]?.[listenerId];
    };
    onCleanup(cleanup);

    return cleanup;
  }

  emit<T extends EventType>(type: T, event: Events[T]): void {
    if (!this.listeners[type]) {
      return;
    }

    for (const id in this.listeners[type] as Record<string, ListenerEntry<T>>) {
      const listener = this.listeners[type]?.[id];
      if (!listener) continue;
      const {
        listener: fn,
        opts: { once },
      } = listener;
      const cleanup = () => delete this.listeners[type]?.[id];
      fn(event, { unsubscribe: cleanup });
      if (once) {
        cleanup();
      }
    }
  }
}

export const bus = new EventBus();
