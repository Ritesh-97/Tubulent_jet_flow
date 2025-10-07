
export interface RowData {
  id: string;
  r: string; // Keep as string for input control
  dp: string; // Keep as string for input control
}

export interface StationData {
  id: string;
  xd: string;
  variac: string;
  port1: string;
  rows: RowData[];
}

export interface GlobalSettings {
  rho: string;
  Dcm: string;
  pUnits: 'kpa' | 'pa';
  contraction: string;
  showSteps: boolean;
}

// Types for computed results
export interface CalculationStep {
  label: string;
  eqn: string;
  subs: string;
  result: number | string;
  units: string;
}

export interface ComputedRow {
  r: number; // in meters
  dpPa: number;
  u: number; // m/s
  psteps: CalculationStep[];
}

export interface CollapsedPoint {
  xr: number; // r / rHalf
  ur: number; // u / Uc
}

export interface TrapezoidSegment {
    i: number;
    r_i: number;
    u_i: number;
    f_i?: number;
    g_i?: number;
    r_ip1: number;
    u_ip1: number;
    f_ip1?: number;
    g_ip1?: number;
    dr: number;
    area_i: number;
}

export interface Trace {
  globals: CalculationStep[];
  points: CalculationStep[][];
  mdot: CalculationStep[];
  I: CalculationStep[];
  Uc: CalculationStep[];
  rhalf: CalculationStep[];
  collapse: CalculationStep[];
  mdotSegments: TrapezoidSegment[];
  ISegments: TrapezoidSegment[];
  warnings: string[];
}


export interface ComputedStation {
  id: string;
  xd: number;
  variac: number;
  port1: number;
  D: number;
  rho: number;
  unitIsKPa: boolean;
  rows: ComputedRow[];
  trace: Trace;
  Uc: number;
  rHalf: number;
  mdot: number;
  I: number;
  collapse: CollapsedPoint[];
  rmse: number;
}

export interface ComputedResults {
  globals: GlobalSettings;
  results: ComputedStation[];
}
