import { Accessor, createSignal, Setter, Signal } from "solid-js";
import { bus } from "./events";

export type RoutineStatus = "locked" | "buyable" | "inactive" | "running";

export interface Routine<T> {
  type: string;
  name: string;
  tickFn: (newTime: Date, deltaTime: number) => void;
  memoryCost: number;
  state: Accessor<T>;
  status: Accessor<RoutineStatus>;
  setStatus: Setter<RoutineStatus>;
}

export interface RoutineConfig<T> {
  type: string;
  initialState: () => T;
  tick?: (
    state: Signal<T>,
    time: {
      newTime: Date;
      deltaTime: number;
    }
  ) => void;
  onStatusChange?: (
    newStatus: RoutineStatus,
    prevStatus: RoutineStatus | undefined,
    state: Signal<T>
  ) => void;
  memoryCost: number;
  status?: RoutineStatus;
}

export function createRoutine<T>(
  name: string,
  cfg: RoutineConfig<T>
): Routine<T> {
  const [state, setState] = createSignal(cfg.initialState());
  const [status, setStatus] = createSignal(cfg.status ?? "locked");

  const changeStatus = (
    newStatus: RoutineStatus | ((prev: RoutineStatus) => RoutineStatus)
  ) => {
    const prevStatus = status();
    setStatus(newStatus);
    const nextStatus = status();
    cfg.onStatusChange?.(nextStatus, prevStatus, [state, setState]);
    bus.emit("routine-status-change", {
      routineName: name,
      prevStatus,
      newStatus: nextStatus,
    });
  };

  return {
    type: cfg.type,
    name,
    memoryCost: cfg.memoryCost,
    tickFn: (newTime, deltaTime) =>
      cfg.tick?.([state, setState], { newTime, deltaTime }),
    state,
    status,
    setStatus: changeStatus,
  };
}
