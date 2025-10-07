
import React, { ChangeEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { GlobalSettings, StationData, RowData } from '../types';

// UI sub-components
const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-slate-900/50 border border-slate-800 rounded-2xl shadow-lg ${className}`}>
    {children}
  </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <h2 className="text-lg font-semibold text-slate-200 mb-3">{children}</h2>
);

const Input: React.FC<{ label: string; hint?: string; value: string | number; onChange: (e: ChangeEvent<HTMLInputElement>) => void; type?: string; step?: string; placeholder?: string; }> = 
({ label, hint, ...props }) => (
    <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
        <input {...props} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition" />
        {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
);

const Select: React.FC<{label: string; value: string; onChange: (e: ChangeEvent<HTMLSelectElement>) => void; children: React.ReactNode}> = ({label, ...props}) => (
    <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
        <select {...props} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none transition" />
    </div>
);

const Button: React.FC<{ children: React.ReactNode; onClick: () => void; variant?: 'primary' | 'secondary' | 'danger'; className?: string }> = 
({ children, onClick, variant = 'secondary', className = '' }) => {
    const baseClasses = "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-transform active:scale-[0.98]";
    const variants = {
        primary: "bg-sky-600/80 border-sky-500 text-white hover:bg-sky-600",
        secondary: "bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700",
        danger: "bg-red-600/40 border-red-500 text-red-200 hover:bg-red-600/60",
    };
    return <button onClick={onClick} className={`${baseClasses} ${variants[variant]} ${className}`}>{children}</button>;
};

// Main Panel Components

interface StationCardProps {
    station: StationData;
    onUpdate: (updatedStation: StationData) => void;
    onRemove: () => void;
    pUnitLabel: string;
}

const StationCard: React.FC<StationCardProps> = ({ station, onUpdate, onRemove, pUnitLabel }) => {

    const handleStationChange = (field: keyof StationData, value: string) => {
        onUpdate({ ...station, [field]: value });
    };

    const handleRowChange = (rowIndex: number, field: keyof RowData, value: string) => {
        const newRows = [...station.rows];
        newRows[rowIndex] = { ...newRows[rowIndex], [field]: value };
        onUpdate({ ...station, rows: newRows });
    };

    const addRow = () => {
        const newRows = [...station.rows, { id: uuidv4(), r: '', dp: '' }];
        onUpdate({ ...station, rows: newRows });
    };
    
    const removeRow = (rowIndex: number) => {
        const newRows = station.rows.filter((_, index) => index !== rowIndex);
        onUpdate({ ...station, rows: newRows });
    };
    
    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasteData = e.clipboardData.getData('text');
        const lines = pasteData.split('\n').filter(line => line.trim() !== '');
        const pastedRows = lines.map(line => {
            const [r, dp] = line.split(/\s+/); // split by whitespace
            return { id: uuidv4(), r: r || '', dp: dp || '' };
        });

        if (pastedRows.length > 0) {
            const updatedRows = [ ...pastedRows ];
            onUpdate({ ...station, rows: updatedRows });
        }
    };


    return (
        <Card className="p-4 mt-3">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="bg-slate-700 text-slate-200 text-xs font-bold px-3 py-1 rounded-full">Station</div>
                     <Input label="x/D" type="number" value={station.xd} onChange={e => handleStationChange('xd', e.target.value)} />
                     <Input label="Variac (V)" type="number" value={station.variac} onChange={e => handleStationChange('variac', e.target.value)} />
                     <Input label="Port1–atm Δp" type="number" placeholder={pUnitLabel} value={station.port1} onChange={e => handleStationChange('port1', e.target.value)} />
                </div>
                 <div className="flex gap-2">
                    <Button onClick={addRow}>+ Row</Button>
                    <Button onClick={onRemove} variant="danger">Remove</Button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-400 uppercase">
                        <tr>
                            <th className="px-2 py-2">r (mm)</th>
                            <th className="px-2 py-2">Δp ({pUnitLabel})</th>
                            <th className="px-2 py-2"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {station.rows.map((row, index) => (
                            <tr key={row.id} className="border-b border-slate-800">
                                <td className="p-1">
                                    <input type="number" step="0.1" value={row.r} onPaste={index === 0 ? handlePaste : undefined}
                                           onChange={e => handleRowChange(index, 'r', e.target.value)} placeholder="0"
                                           className="w-full bg-slate-800 rounded px-2 py-1 outline-none focus:bg-slate-700"/>
                                </td>
                                <td className="p-1">
                                    <input type="number" step="0.001" value={row.dp}
                                           onChange={e => handleRowChange(index, 'dp', e.target.value)} placeholder="e.g., 0.35"
                                           className="w-full bg-slate-800 rounded px-2 py-1 outline-none focus:bg-slate-700"/>
                                </td>
                                <td className="p-1 text-right">
                                  {station.rows.length > 1 && (
                                     <button onClick={() => removeRow(index)} className="text-slate-500 hover:text-red-400 text-xs">
                                        &times;
                                     </button>
                                  )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
             <p className="text-xs text-slate-500 mt-2">Tip: Paste two columns (r and Δp) into the first `r` input field.</p>
        </Card>
    )
};


interface InputPanelProps {
    globals: GlobalSettings;
    setGlobals: React.Dispatch<React.SetStateAction<GlobalSettings>>;
    stations: StationData[];
    setStations: React.Dispatch<React.SetStateAction<StationData[]>>;
    onCompute: () => void;
}

export const InputPanel: React.FC<InputPanelProps> = ({ globals, setGlobals, stations, setStations, onCompute }) => {

    const handleGlobalChange = (field: keyof GlobalSettings, value: string | boolean) => {
        setGlobals(prev => ({ ...prev, [field]: value }));
    };

    const addStation = (xdVal?: number) => {
        const newStation: StationData = {
            id: uuidv4(),
            xd: xdVal ? String(xdVal) : '',
            variac: '',
            port1: '',
            rows: [{ id: uuidv4(), r: '0', dp: '' }, { id: uuidv4(), r: '', dp: '' }]
        };
        setStations(prev => [...prev, newStation]);
    };

    const updateStation = (id: string, updatedStation: StationData) => {
        setStations(prev => prev.map(s => s.id === id ? updatedStation : s));
    };

    const removeStation = (id: string) => {
        setStations(prev => prev.filter(s => s.id !== id));
    };
    
    return (
        <Card className="p-4 space-y-6">
            <div>
                <SectionTitle>1. Global Settings</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input label="Fluid density ρ (kg/m³)" hint="Air @ 20°C ≈ 1.204" type="number" step="0.01" value={globals.rho} onChange={e => handleGlobalChange('rho', e.target.value)} />
                    <Input label="Nozzle exit diameter D (cm)" hint="Default: 2.54 cm" type="number" step="0.01" value={globals.Dcm} onChange={e => handleGlobalChange('Dcm', e.target.value)} />
                    <Select label="Pressure units" value={globals.pUnits} onChange={e => handleGlobalChange('pUnits', e.target.value)}>
                        <option value="kpa">kPa (as in manometer)</option>
                        <option value="pa">Pa</option>
                    </Select>
                    <Input label="Contraction ratio" type="number" step="0.1" value={globals.contraction} onChange={e => handleGlobalChange('contraction', e.target.value)} />
                </div>
            </div>

            <div>
                <SectionTitle>2. Axial Stations (x/D)</SectionTitle>
                <div className="flex flex-wrap gap-2">
                    <Button onClick={() => addStation(10)}>+ Add 10</Button>
                    <Button onClick={() => addStation(20)}>+ Add 20</Button>
                    <Button onClick={() => addStation(30)}>+ Add 30</Button>
                    <Button onClick={() => addStation(40)}>+ Add 40</Button>
                    <Button onClick={() => addStation()}>+ Custom</Button>
                </div>
                 <p className="text-xs text-slate-500 mt-2">Add stations you measured. Each holds r (mm) & Δp rows.</p>
                <div>
                    {stations.map(station => (
                        <StationCard key={station.id} station={station} pUnitLabel={globals.pUnits.toUpperCase()}
                                     onUpdate={(updated) => updateStation(station.id, updated)}
                                     onRemove={() => removeStation(station.id)} />
                    ))}
                </div>
            </div>

            <div>
                <SectionTitle>3. Actions</SectionTitle>
                 <div className="flex items-center gap-4 mb-4">
                    <input id="showSteps" type="checkbox" checked={globals.showSteps} onChange={e => handleGlobalChange('showSteps', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500" />
                    <label htmlFor="showSteps" className="text-sm text-slate-300">Include full step-by-step appendix</label>
                 </div>
                 <div className="flex flex-wrap gap-3">
                    <Button onClick={onCompute} variant="primary">Compute & Plot</Button>
                    <Button onClick={() => window.print()}>Print / Save PDF</Button>
                 </div>
            </div>
        </Card>
    )
}
