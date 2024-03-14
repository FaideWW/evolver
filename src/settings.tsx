import {
  ParentProps,
  Signal,
  createContext,
  createSignal,
  useContext,
} from "solid-js";
import { UnitNotationOption } from "./utils";

interface Settings {
  infoUnitNotation: UnitNotationOption;
}

const SettingsContext = createContext<Signal<Settings>>();

export function SettingsProvider(props: ParentProps) {
  const [state, setState] = createSignal({
    infoUnitNotation: "Windows" as UnitNotationOption,
  });

  const settings = [state, setState] as Signal<Settings>;

  return (
    <SettingsContext.Provider value={settings}>
      {props.children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (ctx === undefined) {
    throw new Error("useSettings called outside a <SettingsProvider>");
  }
  return ctx;
}
