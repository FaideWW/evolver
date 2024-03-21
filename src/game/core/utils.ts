import { useSettings, UnitNotationOption } from "@core/settings";

export const cssInterpolate = (color1: string, color2: string, t: number) => {
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

export const displayTime = (ms: number) => {
  if (ms >= 1000) {
    const s = (ms / 1000).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
    return `${s}s`;
  } else {
    return `${ms.toFixed(0)}ms`;
  }
};

const unitPrefixes: Record<UnitNotationOption, string[]> = {
  Windows: ["", "K", "M", "G", "T", "P", "E", "Z", "Y", "R", "Q"],
  "IEC (decimal)": ["", "k", "M", "G", "T", "P", "E", "Z", "Y", "R", "Q"],
  "IEC (binary)": [
    "",
    "Ki",
    "Mi",
    "Gi",
    "Ti",
    "Pi",
    "Ei",
    "Zi",
    "Yi",
    "Ri",
    "Qi",
  ],
  Scientific: [],
};

export const displayCurrency = (b: number, notation: UnitNotationOption) => {
  if (notation === "Scientific") {
    return "";
  }
  let scaledB = b;
  let orders = 0;
  const divisor = notation === "IEC (decimal)" ? 1000 : 1024;
  while (scaledB >= divisor && orders < unitPrefixes[notation].length) {
    scaledB /= divisor;
    orders++;
  }

  return `${scaledB.toLocaleString(undefined, { maximumFractionDigits: 2 })}${unitPrefixes[notation][orders]
    }b`;
};

export type Modifier = (n: number) => ModValue;
export type ModValue = {
  value: number;
  type: ModType;
};

export type ModType = "flat" | "additive" | "multiplicative";
export type ScaleFn = {
  type: ModType;
  (n?: number): number;
};

export function flat(base: number = 0): ScaleFn {
  const fn = () => base;
  fn.type = "flat" as const;
  return fn;
}

export function additive(added: number, base: number = 0): ScaleFn {
  const fn = (n: number = 0) => base + added * n;
  fn.type = "additive" as const;
  return fn;
}

export function multiplicative(multiplier: number, base: number = 1): ScaleFn {
  const fn = (n: number = 0) => base * multiplier ** n;
  fn.type = "multiplicative" as const;
  return fn;
}

export function applyMods(base: number, mods: ScaleFn[]) {
  let totalAdded = 0;
  let totalMult = 1;
  for (let i = 0; i < mods.length; i++) {
    const mod = mods[i];
    switch (mod.type) {
      case "additive": {
        totalAdded += mod();
        break;
      }
      case "multiplicative": {
        totalMult *= mod();
        break;
      }
    }
  }

  return (base + totalAdded) * totalMult;
}

export function clamp(min: number, max: number, value: number) {
  return Math.max(min, Math.min(max, value));
}

export const currency = (n: number) => {
  const [settings] = useSettings();
  return displayCurrency(n, settings().infoUnitNotation);
};

export const KB = 1024;
export const MB = 1024 * 1024;
export const GB = 1024 * 1024 * 1024;
