import { UnitConversion, UnitOfMeasure, UnitDimension } from "../modules/inventory/types";

export interface ConversionResult {
  success: boolean;
  convertedQty: number;
  factor: number;
  explanation: string;
}

// Built-in standard factor lookup to base dimension unit
// MASS base: KG
// VOLUME base: L
// LENGTH base: M
// AREA base: SQM
const STANDARD_TO_BASE: Record<string, { dimension: UnitDimension; factorToBase: number }> = {
  // Mass (Base: KG)
  KG: { dimension: "MASS", factorToBase: 1 },
  KILOGRAM: { dimension: "MASS", factorToBase: 1 },
  G: { dimension: "MASS", factorToBase: 0.001 },
  GRAM: { dimension: "MASS", factorToBase: 0.001 },
  MG: { dimension: "MASS", factorToBase: 0.000001 },
  MILLIGRAM: { dimension: "MASS", factorToBase: 0.000001 },
  TON: { dimension: "MASS", factorToBase: 1000 },
  LB: { dimension: "MASS", factorToBase: 0.45359237 },
  OZ: { dimension: "MASS", factorToBase: 0.02834952 },

  // Volume (Base: L)
  L: { dimension: "VOLUME", factorToBase: 1 },
  LITER: { dimension: "VOLUME", factorToBase: 1 },
  LTR: { dimension: "VOLUME", factorToBase: 1 },
  ML: { dimension: "VOLUME", factorToBase: 0.001 },
  MILLILITER: { dimension: "VOLUME", factorToBase: 0.001 },
  CL: { dimension: "VOLUME", factorToBase: 0.01 },
  GAL: { dimension: "VOLUME", factorToBase: 3.78541 },
  GALLON: { dimension: "VOLUME", factorToBase: 3.78541 },

  // Length (Base: M)
  M: { dimension: "LENGTH", factorToBase: 1 },
  METER: { dimension: "LENGTH", factorToBase: 1 },
  CM: { dimension: "LENGTH", factorToBase: 0.01 },
  MM: { dimension: "LENGTH", factorToBase: 0.001 },

  // Count (Base: PCS / EACH)
  PCS: { dimension: "COUNT", factorToBase: 1 },
  PIECE: { dimension: "COUNT", factorToBase: 1 },
  EACH: { dimension: "COUNT", factorToBase: 1 },
  DOZEN: { dimension: "COUNT", factorToBase: 12 },
};

/**
 * Smart Unit Conversion Engine
 * Resolves conversion rates between any two units using:
 * 1. Direct item packaging conversions (e.g. 1 Box of Milk = 12 L)
 * 2. Database global conversions
 * 3. Standard SI / Dimensional base unit transformations
 */
export function convertUnits(
  qty: number,
  fromUnitCode?: string | null,
  toUnitCode?: string | null,
  itemId?: number | null,
  conversions: UnitConversion[] = [],
  _units: UnitOfMeasure[] = []
): ConversionResult {
  if (qty === 0 || !fromUnitCode || !toUnitCode) {
    return { success: true, convertedQty: qty, factor: 1, explanation: "Identity" };
  }

  const from = fromUnitCode.trim().toUpperCase();
  const to = toUnitCode.trim().toUpperCase();

  // 1. Identity conversion
  if (from === to) {
    return { success: true, convertedQty: qty, factor: 1, explanation: `1 ${from} = 1 ${to}` };
  }

  // 2. Check Item-Specific Custom Pack/Packaging Conversions
  if (itemId && conversions.length > 0) {
    const itemConv = conversions.find(
      (c) =>
        c.itemId === itemId &&
        ((c.fromUnit?.code?.toUpperCase() === from && c.toUnit?.code?.toUpperCase() === to) ||
          (c.fromUnit?.code?.toUpperCase() === to && c.toUnit?.code?.toUpperCase() === from))
    );

    if (itemConv) {
      const isDirect = itemConv.fromUnit?.code?.toUpperCase() === from;
      const factor = isDirect ? itemConv.factor : 1 / itemConv.factor;
      const convertedQty = roundPrecision(qty * factor);
      return {
        success: true,
        convertedQty,
        factor,
        explanation: `1 ${from} = ${formatNumber(factor)} ${to} (Custom Item Packaging)`,
      };
    }
  }

  // 3. Check Database Global Conversions
  if (conversions.length > 0) {
    const globalConv = conversions.find(
      (c) =>
        !c.itemId &&
        ((c.fromUnit?.code?.toUpperCase() === from && c.toUnit?.code?.toUpperCase() === to) ||
          (c.fromUnit?.code?.toUpperCase() === to && c.toUnit?.code?.toUpperCase() === from))
    );

    if (globalConv) {
      const isDirect = globalConv.fromUnit?.code?.toUpperCase() === from;
      const factor = isDirect ? globalConv.factor : 1 / globalConv.factor;
      const convertedQty = roundPrecision(qty * factor);
      return {
        success: true,
        convertedQty,
        factor,
        explanation: `1 ${from} = ${formatNumber(factor)} ${to} (Standard Database Rule)`,
      };
    }
  }

  // 4. Check Built-in Standard Dimension Conversions (SI Units)
  const fromMeta = STANDARD_TO_BASE[from];
  const toMeta = STANDARD_TO_BASE[to];

  if (fromMeta && toMeta && fromMeta.dimension === toMeta.dimension) {
    // Both belong to same dimension (e.g. MASS: KG, G, MG or VOLUME: L, ML)
    const factor = fromMeta.factorToBase / toMeta.factorToBase;
    const convertedQty = roundPrecision(qty * factor);
    return {
      success: true,
      convertedQty,
      factor,
      explanation: `1 ${from} = ${formatNumber(factor)} ${to} (Standard ${fromMeta.dimension} Formula)`,
    };
  }

  // Fallback: No direct or dimensional conversion found
  return {
    success: false,
    convertedQty: qty,
    factor: 1,
    explanation: `No conversion defined between ${from} and ${to}`,
  };
}

/**
 * Format quantity with unit code
 */
export function formatUnitQty(qty: number, unitCode?: string | null, decimals = 2): string {
  if (qty === undefined || qty === null) return "0";
  const formattedNum = Number(qty).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
  return unitCode ? `${formattedNum} ${unitCode}` : formattedNum;
}

/**
 * Helper to round floating point results cleanly
 */
function roundPrecision(val: number, decimals = 4): number {
  const multiplier = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * multiplier) / multiplier;
}

function formatNumber(val: number): string {
  if (Number.isInteger(val)) return val.toString();
  return Number(val.toFixed(4)).toString();
}
