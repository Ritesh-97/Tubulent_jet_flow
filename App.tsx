
import React, { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { GlobalSettings, StationData, ComputedResults } from './types';
import { computeAll } from './services/calculator';
import { InputPanel } from './components/InputPanel';
import { OutputPanel } from './components/OutputPanel';

const Header: React.FC = () => (
  <header className="sticky top-0 z-10 bg-slate-900/70 backdrop-blur-md border-b border-slate-700 p-4 print:hidden">
    <h1 className="text-xl font-bold text-slate-100 tracking-tight">Turbulent Round Jet Analyzer</h1>
    <p className="text-xs text-slate-400 mt-1">
      Interactive Lab with FULL Step-by-Step Math
    </p>
  </header>
);

const initialStations: StationData[] = [
  {
    id: uuidv4(),
    xd: '8.5',
    variac: '',
    port1: '',
    rows: [
      { id: uuidv4(), r: '0', dp: '0.278' },
      { id: uuidv4(), r: '5', dp: '0.244' },
      { id: uuidv4(), r: '10', dp: '0.124' },
      { id: uuidv4(), r: '15', dp: '0.035' },
      { id: uuidv4(), r: '20', dp: '0.020' },
      { id: uuidv4(), r: '30', dp: '0.002' },
    ]
  },
  {
    id: uuidv4(),
    xd: '18.5',
    variac: '',
    port1: '',
    rows: [
      { id: uuidv4(), r: '0', dp: '0.195' },
      { id: uuidv4(), r: '5', dp: '0.145' },
      { id: uuidv4(), r: '10', dp: '0.110' },
      { id: uuidv4(), r: '15', dp: '0.060' },
      { id: uuidv4(), r: '20', dp: '0.025' },
      { id: uuidv4(), r: '25', dp: '0.016' },
      { id: uuidv4(), r: '30', dp: '0.010' },
    ]
  },
  {
    id: uuidv4(),
    xd: '28.5',
    variac: '',
    port1: '',
    rows: [
      { id: uuidv4(), r: '0', dp: '0.100' },
      { id: uuidv4(), r: '5', dp: '0.065' },
      { id: uuidv4(), r: '14', dp: '0.045' },
      { id: uuidv4(), r: '21', dp: '0.022' },
      { id: uuidv4(), r: '28', dp: '0.012' },
      { id: uuidv4(), r: '35', dp: '0.005' },
    ]
  }
];


const App: React.FC = () => {
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    rho: '1.204',
    Dcm: '2.54',
    pUnits: 'kpa',
    contraction: '9.0',
    showSteps: true,
  });

  const [stations, setStations] = useState<StationData[]>(initialStations);
  const [computedResults, setComputedResults] = useState<ComputedResults | null>(null);

  const handleCompute = useCallback(() => {
    const results = computeAll(stations, globalSettings);
    if (results.results.length === 0) {
      alert('Please add at least one station with 2 or more valid data rows.');
      return;
    }
    setComputedResults(results);
    setTimeout(() => {
        document.getElementById('output-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, [stations, globalSettings]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-gray-900">
      <Header />
      <main className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4 xl:col-span-3 print:hidden">
            <InputPanel 
                globals={globalSettings}
                setGlobals={setGlobalSettings}
                stations={stations}
                setStations={setStations}
                onCompute={handleCompute}
            />
        </div>
        <div id="output-panel" className="lg:col-span-8 xl:col-span-9 print:!col-span-12">
            <OutputPanel results={computedResults} />
        </div>
      </main>
    </div>
  );
};

export default App;
