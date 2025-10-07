import React, { useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ScatterChart, Scatter, ZAxis, ComposedChart } from 'recharts';
import { ComputedResults, CalculationStep, TrapezoidSegment, ComputedStation } from '../types';
// FIX: Import the cm2m utility function to be used in the Report component.
import { pretty, cm2m } from '../services/calculator';

// UI sub-components
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-slate-900/50 border border-slate-800 rounded-2xl shadow-lg print:border-gray-200 print:shadow-none ${className}`}>
    {children}
  </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className='' }) => (
    <h3 className={`text-base font-semibold text-slate-200 mb-3 print:text-black ${className}`}>{children}</h3>
);

const KpiCard: React.FC<{ label: string, value: string, tone: 'good' | 'warn' | 'neutral' }> = ({ label, value, tone }) => {
    const colors = {
        good: 'text-green-400',
        warn: 'text-amber-400',
        neutral: 'text-sky-400'
    };
    return (
        <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
            <div className="text-xs text-slate-400">{label}</div>
            <div className={`text-xl font-bold mt-1 ${colors[tone]}`}>{value}</div>
        </div>
    );
}

const PlotContainer: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <div className="print:break-inside-avoid">
        <p className="text-sm text-center text-slate-400 mb-2 print:text-black">{title}</p>
        <div className="w-full h-64 md:h-80 bg-slate-900 border border-slate-800 rounded-xl p-2 print:border-gray-300 print:bg-white">
            {children}
        </div>
    </div>
);

// Report sub-components
const ReportSection: React.FC<{ title: string, children: React.ReactNode}> = ({ title, children }) => (
    <div className="mt-4 p-4 bg-slate-800/30 border border-slate-700 rounded-lg print:border-gray-300 print:bg-white">
        <h2 className="text-xl font-bold text-sky-300 border-b border-sky-800 pb-2 mb-3 print:text-sky-700 print:border-sky-300">{title}</h2>
        <div className="space-y-3 text-sm leading-relaxed text-slate-300 print:text-gray-800">{children}</div>
    </div>
);

const CalculationDetails: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <details className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 my-2 print:border-gray-300">
        <summary className="cursor-pointer font-semibold text-slate-200 print:text-black">{title}</summary>
        <div className="mt-2">{children}</div>
    </details>
);

const Step: React.FC<{ step: CalculationStep }> = ({ step }) => (
    <div className="font-mono text-xs whitespace-pre-wrap">
        <span className="text-slate-400">{step.label}: {step.eqn}</span>
        <br/>
        <span className="text-slate-500 pl-2">{step.subs}</span>
        <br/>
        <span className="text-sky-400 pl-2">⇒ {pretty(step.result)} {step.units}</span>
    </div>
);

// Main OutputPanel
interface OutputPanelProps {
    results: ComputedResults | null;
}

export const OutputPanel: React.FC<OutputPanelProps> = ({ results }) => {
    
    const chartData = useMemo(() => {
        if (!results || results.results.length === 0) return null;

        const colors = ['#38bdf8', '#4ade80', '#facc15', '#f87171', '#c084fc', '#f97316'];
        const stationColors: {[key: number]: string} = {};
        results.results.forEach((st, i) => {
            stationColors[st.xd] = colors[i % colors.length];
        });
        
        // Velocity profiles
        // FIX: Add explicit types to the sort callback to prevent potential type inference issues with arithmetic operations.
        const allR = [...new Set(results.results.flatMap(s => s.rows.map(r => r.r)))].sort((a: number, b: number) => a - b);
        const profileData = allR.map(rVal => {
            const point: any = { r: rVal };
            results.results.forEach(st => {
                const row = st.rows.find(p => p.r === rVal);
                point[`u_${st.xd}`] = row?.u;
            });
            return point;
        });

        // Collapsed plot
        const collapsedData = results.results.flatMap(st => st.collapse.map(p => ({...p, xd: st.xd})));
        const ln2 = Math.log(2);
        const gaussianData = Array.from({length: 101}, (_, i) => {
            const xr = (i/100) * (Math.max(...collapsedData.map(p => p.xr), 2));
            return { xr, ur: Math.exp(-ln2 * xr * xr) };
        });

        // Trend plots
        const trendData = results.results.map(st => ({
            xd: st.xd,
            Uc: st.Uc,
            mdot: st.mdot,
            I: st.I
        })).sort((a,b) => a.xd - b.xd);

        return { profileData, collapsedData, gaussianData, trendData, stationColors };
    }, [results]);

    const kpiData = useMemo(() => {
        if (!results || results.results.length < 2) return null;
        const sorted = [...results.results].sort((a,b) => a.xd - b.xd);
        const first = sorted[0];
        const last = sorted[sorted.length-1];
        const pct = (a: number, b: number) => (b !== 0 ? (100 * (a - b) / b) : NaN);
        const dUc = pct(last.Uc, first.Uc);
        const dmd = pct(last.mdot, first.mdot);
        const dI = pct(last.I, first.I);
        return { dUc, dmd, dI };
    }, [results]);
    
    if (!results) {
        return (
            <Card className="p-6 h-full flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-slate-300">Awaiting Computation</h2>
                    <p className="text-slate-500 mt-2">Enter your data and click "Compute & Plot" to see the results here.</p>
                </div>
            </Card>
        );
    }
    
    return (
        <Card className="p-4 space-y-6">
            <SectionTitle>Plots & Key Results</SectionTitle>
            
            {kpiData && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* FIX: Access dUc, dmd, and dI from the kpiData object. */}
                    <KpiCard label="Centerline Velocity Change" value={`${kpiData.dUc.toFixed(1)}%`} tone={kpiData.dUc <=0 ? 'warn':'good'} />
                    <KpiCard label="Mass Flow Change (Entrainment)" value={`+${kpiData.dmd.toFixed(1)}%`} tone={kpiData.dmd >=0 ? 'good':'warn'} />
                    <KpiCard label="Momentum Conservation Check" value={`${kpiData.dI.toFixed(1)}%`} tone={Math.abs(kpiData.dI) < 15 ? 'good' : 'warn'} />
                </div>
            )}
            
            <PlotContainer title="Velocity Profiles u(r) at each x/D">
                <ResponsiveContainer>
                    <LineChart data={chartData?.profileData} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="r" type="number" label={{ value: 'r (m)', position: 'insideBottom', offset: -10 }} stroke="#94a3b8" tick={{fontSize: 12}} />
                        <YAxis label={{ value: 'u (m/s)', angle: -90, position: 'insideLeft' }} stroke="#94a3b8" tick={{fontSize: 12}} tickFormatter={(v) => v.toFixed(2)}/>
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
                        <Legend />
                        {results.results.map(st => (
                            <Line key={st.id} type="monotone" dataKey={`u_${st.xd}`} name={`x/D=${st.xd}`} stroke={chartData?.stationColors[st.xd]} dot={false} strokeWidth={2} connectNulls={true} />
                        ))}
                    </LineChart>
                </ResponsiveContainer>
            </PlotContainer>

            <PlotContainer title="Self-Similar Collapse: u/Uc vs r/r½ (Gaussian overlay)">
                 <ResponsiveContainer>
                    <ComposedChart margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="xr" type="number" domain={[0, 'dataMax']} label={{ value: 'r / r½', position: 'insideBottom', offset: -10 }} stroke="#94a3b8" tick={{fontSize: 12}} />
                        <YAxis dataKey="ur" type="number" domain={[0, 1.1]} label={{ value: 'u / Uc', angle: -90, position: 'insideLeft' }} stroke="#94a3b8" tick={{fontSize: 12}}/>
                        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}/>
                        <Legend />
                        <ZAxis dataKey="xd" name="x/D" />
                        
                        {results.results.map(st => {
                            const stationData = chartData?.collapsedData.filter(p => p.xd === st.xd);
                            return (
                                <React.Fragment key={st.id}>
                                    <Scatter 
                                        name={`x/D=${st.xd}`} 
                                        data={stationData} 
                                        fill={chartData?.stationColors[st.xd]} 
                                        shape="circle"
                                    />
                                    <Line 
                                        type="monotone"
                                        data={stationData}
                                        dataKey="ur"
                                        stroke={chartData?.stationColors[st.xd]}
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={false}
                                        legendType="none"
                                    />
                                </React.Fragment>
                            )
                        })}

                         <Line dataKey="ur" data={chartData?.gaussianData} name="Gaussian" stroke="#94a3b8" dot={false} strokeWidth={2} strokeDasharray="5 5" />
                    </ComposedChart>
                </ResponsiveContainer>
            </PlotContainer>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <PlotContainer title="Centerline velocity Uc vs x/D">
                     <ResponsiveContainer>
                        <LineChart data={chartData?.trendData} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="xd" label={{ value: 'x/D', position: 'insideBottom', offset: -10 }} stroke="#94a3b8" tick={{fontSize: 12}}/>
                            <YAxis stroke="#94a3b8" tick={{fontSize: 12}} />
                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}/>
                            <Line type="monotone" dataKey="Uc" name="Uc (m/s)" stroke="#38bdf8" strokeWidth={2} />
                        </LineChart>
                     </ResponsiveContainer>
                 </PlotContainer>
                 <PlotContainer title="Mass flow rate ṁ vs x/D">
                      <ResponsiveContainer>
                        <LineChart data={chartData?.trendData} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="xd" label={{ value: 'x/D', position: 'insideBottom', offset: -10 }} stroke="#94a3b8" tick={{fontSize: 12}}/>
                            <YAxis stroke="#94a3b8" tick={{fontSize: 12}} tickFormatter={(v) => v.toExponential(1)}/>
                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}/>
                            <Line type="monotone" dataKey="mdot" name="ṁ (kg/s)" stroke="#4ade80" strokeWidth={2} />
                        </LineChart>
                     </ResponsiveContainer>
                 </PlotContainer>
                 <PlotContainer title="Momentum flux ℑ vs x/D">
                      <ResponsiveContainer>
                        <LineChart data={chartData?.trendData} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="xd" label={{ value: 'x/D', position: 'insideBottom', offset: -10 }} stroke="#94a3b8" tick={{fontSize: 12}}/>
                            <YAxis stroke="#94a3b8" tick={{fontSize: 12}} tickFormatter={(v) => v.toExponential(1)}/>
                            <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}/>
                            <Line type="monotone" dataKey="I" name="ℑ (N)" stroke="#facc15" strokeWidth={2} />
                        </LineChart>
                     </ResponsiveContainer>
                 </PlotContainer>
            </div>
            
            <div className="border-t border-slate-800 my-6 print:border-gray-300"></div>

            <div id="report" className="print:text-sm">
                <SectionTitle className="!text-2xl print:!text-3xl">Detailed Report</SectionTitle>
                <Report results={results} kpiData={kpiData} />
            </div>

        </Card>
    );
};


const Report: React.FC<{ results: ComputedResults, kpiData: {dUc:number; dmd:number; dI: number;} | null}> = ({results, kpiData}) => {
    const { globals, results: stations } = results;
    const sorted = [...stations].sort((a,b) => a.xd - b.xd);
    const pUnitLabel = globals.pUnits.toUpperCase();

    const TrapezoidTable: React.FC<{ segments: TrapezoidSegment[], type: 'mdot' | 'I' }> = ({ segments, type }) => {
        const h = type === 'mdot' 
            ? { v: 'f', u: 'ρu·r', hu: 'kg·s⁻¹·m⁻¹' }
            : { v: 'g', u: 'ρu²·r', hu: 'N·m⁻¹' };
        
        return (
             <div className="overflow-x-auto">
                 <table className="w-full text-xs text-left font-mono my-2">
                    <thead className="text-slate-400 print:text-gray-600">
                        <tr>
                            <th className="p-1">i</th>
                            <th className="p-1">r_i</th>
                            <th className="p-1">u_i</th>
                            <th className="p-1">{h.v}_i={h.u}</th>
                            <th className="p-1">Δr</th>
                            <th className="p-1">Area_i</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 print:divide-gray-200">
                        {segments.map(s => (
                            <tr key={s.i}>
                                <td className="p-1">{s.i}</td>
                                <td className="p-1">{pretty(s.r_i, 4)}</td>
                                <td className="p-1">{pretty(s.u_i, 4)}</td>
                                <td className="p-1">{pretty(type === 'mdot' ? s.f_i! : s.g_i!, 4)}</td>
                                <td className="p-1">{pretty(s.dr, 4)}</td>
                                <td className="p-1">{pretty(s.area_i, 4)}</td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
             </div>
        )
    };
    
    return (
        <div className="prose prose-invert prose-sm max-w-none print:prose-sm print:prose-black">
            <ReportSection title="A. Introduction & Objective">
                <p>This report characterizes a turbulent round jet issuing into a quiescent environment. The objectives are to quantify: (i) centerline velocity decay and jet spreading, (ii) mass-flow increase via ambient fluid entrainment, (iii) streamwise momentum conservation, and (iv) the self-similarity of radial velocity profiles.</p>
                <div className="text-xs p-3 bg-slate-800 rounded-md print:bg-gray-100">
                    <strong>Inputs:</strong> ρ = <strong>{globals.rho}</strong> kg/m³, D = <strong>{pretty(cm2m(parseFloat(globals.Dcm)))}</strong> m, Contraction Ratio = <strong>{globals.contraction}</strong>, Pressure Unit = <strong>{pUnitLabel}</strong>.
                </div>
            </ReportSection>

             <ReportSection title="B. Summary of Results">
                 <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="border-b border-slate-600 print:border-gray-400">
                            <tr>
                                <th className="p-2">x/D</th><th>Variac (V)</th><th>Uc (m/s)</th><th>r½ (m)</th><th>ṁ (kg/s)</th><th>ℑ (N)</th><th>Collapse RMSE</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700 print:divide-gray-300">
                            {sorted.map(st => (
                                <tr key={st.id}>
                                    <td className="p-2 font-bold">{st.xd}</td>
                                    <td className="p-2">{isFinite(st.variac) ? st.variac : '—'}</td>
                                    <td className="p-2">{pretty(st.Uc, 4)}</td>
                                    <td className="p-2">{isFinite(st.rHalf) ? pretty(st.rHalf, 4) : '—'}</td>
                                    <td className="p-2">{pretty(st.mdot, 4)}</td>
                                    <td className="p-2">{pretty(st.I, 4)}</td>
                                    <td className="p-2">{isFinite(st.rmse) ? pretty(st.rmse, 4) : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                 </div>
            </ReportSection>
            
            <ReportSection title="C. Analysis & Discussion">
                {kpiData && (
                    <>
                    <p><strong>Velocity Profile Evolution:</strong> With increasing axial distance (x/D), the centerline velocity (Uc) decays by <strong>{kpiData.dUc.toFixed(1)}%</strong> from the first to the last measured station. This decay is accompanied by jet spreading, indicated by a growing half-velocity radius (r½).</p>
                    <p><strong>Mass Flow & Entrainment:</strong> The mass flow rate (ṁ), calculated via the integral ṁ = 2π∫ρu·r·dr, increases by <strong>{kpiData.dmd.toFixed(1)}%</strong> downstream. This increase is a direct result of the jet entraining quiescent ambient fluid.</p>
                    <p><strong>Momentum Flux:</strong> The momentum flux (ℑ), calculated via ℑ = 2π∫ρu²·r·dr, changes by <strong>{kpiData.dI.toFixed(1)}%</strong>. For an ideal jet, momentum is conserved. The observed deviation of {Math.abs(kpiData.dI).toFixed(1)}% is likely due to measurement uncertainties and finite integration limits.</p>
                    </>
                )}
                <p><strong>Self-Similarity:</strong> When scaled by local centerline velocity (u/Uc) and plotted against a scaled radial coordinate (r/r½), the velocity profiles for different x/D stations collapse onto a single curve. The root-mean-square error (RMSE) between the collapsed data and an ideal Gaussian profile provides a quantitative measure of this self-similarity across all stations.</p>
            </ReportSection>

            {globals.showSteps && (
                <ReportSection title="D. Appendix: Step-by-Step Calculations">
                    <p>This section provides a detailed, auditable trail of all calculations performed.</p>

                    <CalculationDetails title="Global Parameters & Conversions">
                        {stations[0]?.trace.globals.map((s, i) => <Step key={i} step={s} />)}
                    </CalculationDetails>

                    {sorted.map(st => (
                        <div key={st.id} className="mt-4 p-3 bg-slate-900/40 border border-slate-700 rounded-lg print:border-gray-300 print:bg-white/50">
                            <h4 className="text-lg font-bold text-slate-200 print:text-black">Station at x/D = {st.xd}</h4>
                            {st.trace.warnings.length > 0 && (
                                <div className="my-2 p-2 bg-amber-900/50 border border-amber-700 text-amber-200 text-xs rounded-md">
                                    <strong>Warnings:</strong>
                                    <ul className="list-disc pl-5">
                                        {st.trace.warnings.map((w, i) => <li key={i}>{w}</li>)}
                                    </ul>
                                </div>
                            )}
                            <CalculationDetails title="Velocity Profile u(r) Calculations">
                                {st.rows.map((row, i) => (
                                    <div key={i} className="my-2 p-2 border-t border-slate-700 print:border-gray-300">
                                         <p className="text-xs text-slate-400">For r = {pretty(row.r * 1000)} mm ({pretty(row.r)} m), Δp = {pretty(row.dpPa / (st.unitIsKPa ? 1000 : 1))} {pUnitLabel}</p>
                                         {row.psteps.map((s, j) => <Step key={j} step={s} />)}
                                    </div>
                                ))}
                            </CalculationDetails>
                            <CalculationDetails title="Centerline Velocity Uc & Half-Radius r½">
                                {st.trace.Uc.map((s, i) => <Step key={i} step={s} />)}
                                <hr className="border-slate-700 my-2 print:border-gray-300" />
                                {st.trace.rhalf.map((s, i) => <Step key={i} step={s} />)}
                            </CalculationDetails>
                            <CalculationDetails title="Mass Flow Rate ṁ Integration">
                                <p>Using trapezoidal rule on <strong>f(r) = ρ·u·r</strong>. Total ṁ = 2π · ∫f(r)dr.</p>
                                <TrapezoidTable segments={st.trace.mdotSegments} type="mdot" />
                                {st.trace.mdot.map((s, i) => <Step key={i} step={s} />)}
                            </CalculationDetails>
                            <CalculationDetails title="Momentum Flux ℑ Integration">
                                <p>Using trapezoidal rule on <strong>g(r) = ρ·u²·r</strong>. Total ℑ = 2π · ∫g(r)dr.</p>
                                <TrapezoidTable segments={st.trace.ISegments} type="I" />
                                {st.trace.I.map((s, i) => <Step key={i} step={s} />)}
                            </CalculationDetails>
                             <CalculationDetails title="Self-Similar Collapse & RMSE">
                                {st.trace.collapse.map((s, i) => <Step key={i} step={s} />)}
                            </CalculationDetails>
                        </div>
                    ))}
                </ReportSection>
            )}
        </div>
    );
};
