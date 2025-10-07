import { GlobalSettings, StationData, ComputedResults, ComputedStation, Trace, CalculationStep, RowData, TrapezoidSegment } from '../types';

// Utility Functions
const mm2m = (v: number): number => v / 1000;
// FIX: Export the cm2m function to make it available for import in other files.
export const cm2m = (v: number): number => v / 100;
const kPa2Pa = (v: number): number => v * 1000;

export const pretty = (val: number | string, digits = 6): string => {
  if (typeof val === 'string') return val;
  if (!isFinite(val)) return '—';
  const a = Math.abs(val);
  if (a !== 0 && (a < 1e-3 || a >= 1e4)) return val.toExponential(3);
  return val.toFixed(digits);
};

// Step Logging helpers
const mkTrace = (): Trace => ({
  globals: [],
  points: [],
  mdot: [],
  I: [],
  Uc: [],
  rhalf: [],
  collapse: [],
  mdotSegments: [],
  ISegments: [],
  warnings: [],
});

const step = (label: string, eqn: string, subs: string, result: number | string, units: string): CalculationStep => ({
  label, eqn, subs, result, units
});

const pushWarn = (T: Trace, msg: string): void => { T.warnings.push(msg); };

const interpolateRhalf = (r: number[], u: number[], Uc: number, trace: Trace): number => {
    if (Uc <= 0) return NaN;
    const target_u = Uc / 2;
    
    // Interpolate ln(u) vs r^2 for better accuracy with Gaussian-like profiles.
    const transformed = r.map((ri, i) => ({ r2: ri * ri, lnu: u[i] > 0 ? Math.log(u[i]) : -Infinity }))
        .filter(p => isFinite(p.lnu));

    const target_lnu = Math.log(target_u);
    
    for (let i = 0; i < transformed.length - 1; i++) {
        const p1 = transformed[i];
        const p2 = transformed[i+1];
        if ((p1.lnu >= target_lnu && p2.lnu <= target_lnu)) {
            const t = (target_lnu - p1.lnu) / (p2.lnu - p1.lnu);
            const r2_half = p1.r2 + t * (p2.r2 - p1.r2);
            const rHalf = Math.sqrt(r2_half);
            trace.rhalf.push(step('Half-velocity radius (interp.)', '(E4) u(r½)=½Uc on ln(u) vs r² plot', `½Uc=${pretty(target_u)} → r½²≈${pretty(r2_half)} → r½≈${pretty(rHalf)}`, rHalf, 'm'));
            return rHalf;
        }
    }

    // Fallback to simple linear interpolation on u vs r if the above fails
    for (let i = 0; i < u.length - 1; i++) {
        const u1 = u[i], u2 = u[i+1];
        if ((u1 >= target_u && u2 <= target_u)) {
          const t = (target_u - u1) / (u2 - u1);
          const rHalf = r[i] + t * (r[i + 1] - r[i]);
          trace.rhalf.push(step('Half-velocity radius (linear fallback)', '(E4) u(r½)=½Uc', `½Uc=${pretty(target_u)} → r½≈${pretty(rHalf)}`, rHalf, 'm'));
          return rHalf;
        }
    }
    
    return NaN;
};


export const computeAll = (stations: StationData[], globals: GlobalSettings): ComputedResults => {
  const { rho: rhoStr, Dcm: DcmStr, pUnits, contraction } = globals;
  const rho = parseFloat(rhoStr) || 1.204;
  const D = cm2m(parseFloat(DcmStr) || 2.54);
  const unitIsKPa = pUnits === 'kpa';

  const computedStations: ComputedStation[] = stations.map(st => {
    const xd = parseFloat(st.xd);
    if (!isFinite(xd)) return null;

    const trace = mkTrace();
    trace.globals.push(step('Density', '(G1) ρ', `ρ = ${rho} kg·m⁻³`, rho, 'kg·m⁻³'));
    trace.globals.push(step('Diameter', '(G2) D', `D = ${D} m`, D, 'm'));
    trace.globals.push(step('Pressure Units', '(G3) units', `Δp in ${unitIsKPa ? 'kPa' : 'Pa'}`, unitIsKPa ? 'kPa' : 'Pa', ''));

    const parsedRows = st.rows
      .map((row: RowData) => ({ rmm: parseFloat(row.r), dpIn: parseFloat(row.dp) }))
      .filter(r => isFinite(r.rmm) && isFinite(r.dpIn));

    if (parsedRows.length < 2) return null;

    const computedRows = parsedRows.map(({ rmm, dpIn }) => {
      const dpPa = unitIsKPa ? kPa2Pa(dpIn) : dpIn;
      const psteps: CalculationStep[] = [];
      if (unitIsKPa) {
        psteps.push(step(`Δp convert`, '(E1) Δp_Pa = 1000·Δp_kPa', `Δp_kPa = ${dpIn}`, dpPa, 'Pa'));
      } else {
        psteps.push(step(`Δp input`, '(E1) Δp_Pa = Δp_Pa', `Δp_Pa = ${dpPa}`, dpPa, 'Pa'));
      }
      const u = Math.sqrt(Math.max(0, 2 * dpPa / rho));
      psteps.push(step('Velocity from Pitot', '(E2) u = √(2Δp/ρ)', `u = √(2·${pretty(dpPa)} Pa / ${rho} kg·m⁻³)`, u, 'm·s⁻¹'));

      return { r: mm2m(rmm), dpPa, u, psteps };
    });

    computedRows.sort((a, b) => a.r - b.r);

    for(let i=1; i<computedRows.length; i++){
        if(computedRows[i].r === computedRows[i-1].r){ pushWarn(trace, `Duplicate r at ${computedRows[i].r} m.`); }
        if(computedRows[i].u > computedRows[i-1].u) {
            pushWarn(trace, `Non-monotonic velocity profile detected near r=${pretty(computedRows[i].r,4)} m (u increases from ${pretty(computedRows[i-1].u,4)} to ${pretty(computedRows[i].u,4)}).`);
        }
    }

    const r = computedRows.map(o => o.r);
    const u = computedRows.map(o => o.u);

    // Centerline Uc
    let Uc: number;
    if (r[0] === 0) {
      Uc = u[0];
      trace.Uc.push(step('Centerline velocity', '(E3) Uc = u(r=0)', `Uc = u(0) = ${pretty(Uc)} m·s⁻¹`, Uc, 'm·s⁻¹'));
    } else if (r.length >= 2) {
        const [r1, u1, r2, u2] = [r[0], u[0], r[1], u[1]];
        const r1_sq = r1 * r1;
        const r2_sq = r2 * r2;
        if (Math.abs(r1_sq - r2_sq) < 1e-12) {
            Uc = u1 + (u2 - u1) * (0 - r1) / (r2 - r1);
            trace.Uc.push(step('Centerline (linear fallback)', '(E3i) Uc = u1 + (u2-u1)*(0-r1)/(r2-r1)', `u1=${pretty(u1)}, u2=${pretty(u2)}, r1=${pretty(r1)} m, r2=${pretty(r2)} m`, Uc, 'm·s⁻¹'));
        } else {
            const a = (u1 - u2) / (r1_sq - r2_sq);
            Uc = u1 - a * r1_sq;
            trace.Uc.push(step('Centerline (quadratic extrap.)', '(E3q) u=a·r²+Uc fit to first 2 pts', `a=${pretty(a)}, u1=${pretty(u1)}, r1=${pretty(r1)} → Uc=${pretty(Uc)}`, Uc, 'm·s⁻¹'));
        }
    } else {
        Uc = u[0] || NaN;
        pushWarn(trace, 'Cannot extrapolate Uc, not enough data points with r>0.');
        trace.Uc.push(step('Centerline velocity (assumed)', '(E3) Uc = u(r_min)', `Uc ≈ u(${pretty(r[0])}) = ${pretty(Uc)}`, Uc, 'm·s⁻¹'));
    }

    // r_half
    let rHalf = interpolateRhalf(r, u, Uc, trace);
    if (!isFinite(rHalf)) {
      trace.rhalf.push(step('Half-velocity radius', '(E4) not found', `No crossing of ½Uc`, NaN, 'm'));
      pushWarn(trace, 'Could not determine r1/2 (no crossing of Uc/2).');
      rHalf = NaN;
    }

    // Integrals
    const f = r.map((ri, i) => rho * u[i] * ri);
    const g = r.map((ri, i) => rho * u[i] * u[i] * ri);
    let area_f = 0, area_g = 0;
    for (let i = 0; i < r.length - 1; i++) {
      const dr = r[i + 1] - r[i];
      const Af = 0.5 * (f[i] + f[i + 1]) * dr;
      const Ag = 0.5 * (g[i] + g[i + 1]) * dr;
      area_f += Af; area_g += Ag;
      trace.mdotSegments.push({i, r_i:r[i], u_i:u[i], f_i:f[i], r_ip1:r[i+1], u_ip1:u[i+1], f_ip1:f[i+1], dr, area_i:Af});
      trace.ISegments.push({i, r_i:r[i], u_i:u[i], g_i:g[i], r_ip1:r[i+1], u_ip1:u[i+1], g_ip1:g[i+1], dr, area_i:Ag});
    }
    const mdot_trapz = 2 * Math.PI * area_f;
    const I_trapz = 2 * Math.PI * area_g;
    trace.mdot.push(step('Mass flow (trapezoid)', '(E5)+(E6)', `2π·Σ ½(f_i+f_{i+1})Δr`, mdot_trapz, 'kg·s⁻¹'));
    trace.I.push(step('Momentum (trapezoid)', '(E7)+(E8)', `2π·Σ ½(g_i+g_{i+1})Δr`, I_trapz, 'N'));

    // Tail correction
    let mdot = mdot_trapz;
    let I = I_trapz;
    if (isFinite(Uc) && isFinite(rHalf) && rHalf > 0 && r.length > 0) {
        const B = Math.log(2) / (rHalf * rHalf);
        const r_n = r[r.length - 1];

        const tail_mdot = (Math.PI * rho * Uc / B) * Math.exp(-B * r_n * r_n);
        mdot += tail_mdot;
        trace.mdot.push(step('Mass flow (tail correction)', '(E6t) ṁ_tail = (πρUc/B)·exp(-B·rₙ²)', `B=${pretty(B,4)}, rₙ=${pretty(r_n,4)} → ṁ_tail=${pretty(tail_mdot)}`, tail_mdot, 'kg·s⁻¹'));
        trace.mdot.push(step('Mass flow (total)', '(E6 F) ṁ = ṁ_trapz + ṁ_tail', `${pretty(mdot_trapz)} + ${pretty(tail_mdot)} = ${pretty(mdot)}`, mdot, 'kg·s⁻¹'));
        
        const tail_I = (Math.PI * rho * Uc * Uc / (2 * B)) * Math.exp(-2 * B * r_n * r_n);
        I += tail_I;
        trace.I.push(step('Momentum (tail correction)', '(E8t) ℑ_tail = (πρUc²/(2B))·exp(-2B·rₙ²)', `B=${pretty(B,4)}, rₙ=${pretty(r_n,4)} → ℑ_tail=${pretty(tail_I)}`, tail_I, 'N'));
        trace.I.push(step('Momentum (total)', '(E8 F) ℑ = ℑ_trapz + ℑ_tail', `${pretty(I_trapz)} + ${pretty(tail_I)} = ${pretty(I)}`, I, 'N'));
    } else {
        pushWarn(trace, 'Tail correction for integrals skipped (Uc or r1/2 not available).');
    }

    // Collapse
    const collapse = (isFinite(rHalf) && rHalf > 0) ? r.map((ri, i) => {
        const xr = ri / rHalf;
        const ur = u[i] / Uc;
        trace.collapse.push(step(`Collapse (r=${pretty(ri,4)})`, '(E9) xr=r/r½, ur=u/Uc', `xr=${pretty(ri,4)}/${pretty(rHalf,4)}, ur=${pretty(u[i],4)}/${pretty(Uc,4)}`, `(${pretty(xr,4)}, ${pretty(ur,4)})`, ''));
        return { xr, ur };
    }) : [];

    // RMSE
    let rmse = NaN;
    if (collapse.length > 0) {
        const ln2 = Math.log(2);
        const sumSqErr = collapse.reduce((sum, p) => {
            const gaussian_ur = Math.exp(-ln2 * p.xr * p.xr);
            const err = p.ur - gaussian_ur;
            trace.collapse.push(step(`RMSE point (xr=${pretty(p.xr, 4)})`, '(E10) err = ur - exp(-ln(2)·xr²)', `err = ${pretty(p.ur,4)} - ${pretty(gaussian_ur,4)}`, err*err, ''));
            return sum + err * err;
        }, 0);
        rmse = Math.sqrt(sumSqErr / collapse.length);
        trace.collapse.push(step(`RMSE final`, 'RMSE=√(Σ(err²)/N)', `RMSE=√(${pretty(sumSqErr,4)}/${collapse.length})`, rmse, ''));
    }

    return {
        id: st.id,
        xd: xd,
        variac: parseFloat(st.variac),
        port1: parseFloat(st.port1),
        D: D,
        rho: rho,
        unitIsKPa: unitIsKPa,
        rows: computedRows,
        trace: trace,
        Uc: Uc,
        rHalf: rHalf,
        mdot: mdot,
        I: I,
        collapse: collapse,
        rmse: rmse
    };
  }).filter(st => st !== null) as ComputedStation[];

  return { globals, results: computedStations };
};
