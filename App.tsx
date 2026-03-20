import React, { useState, useEffect, useCallback } from 'react';
import { TARIFS, PAYMENT_METHODS, HOSTS, getRateForApartment } from './constants';
import { ReceiptData } from './types';
import ReceiptPreview from './components/ReceiptPreview';

const ACCESS_PASSWORD = "TON_MOT_DE_PASSE"; // ⚠️ À remettre

function App() {
  const generateNewId = () => `RC-${Math.floor(100000 + Math.random() * 900000)}`;

  const getInitialState = (): ReceiptData => ({
    receiptId: generateNewId(),
    calendarSlug: '',
    firstName: '', lastName: '', phone: '', email: '',
    apartmentName: '', startDate: '', endDate: '',
    isCustomRate: false, customLodgingTotal: 0,
    isNegotiatedRate: false, negotiatedPricePerNight: 0,
    payments: [{ id: Date.now().toString(), date: new Date().toISOString().split('T')[0], amount: 0, method: 'Espèces' }],
    signature: '', hosts: [], electricityCharge: false, packEco: false, observations: ''
  });

  // --- ÉTATS ---
  const [formData, setFormData] = useState<ReceiptData>(getInitialState());
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [searchId, setSearchId] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(sessionStorage.getItem('yame_auth') === 'true');
  const [passwordInput, setPasswordInput] = useState('');
  
  // LOGIQUE MODE MÉNAGE
  const urlParams = new URLSearchParams(window.location.search);
  const isCleaningMode = urlParams.has('menageId');
  const [isReadOnly, setIsReadOnly] = useState(urlParams.has('id'));

  // Champs spécifiques au ménage
  const [cleaningReport, setCleaningReport] = useState({
    agent: '',
    status: 'EFFECTUÉ',
    feedback: '',
    damages: '',
    maintenance: ''
  });

  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzfajRxCsKs0CLU4oiA6g5sirHUJHB3QdlJPeKOrjgFFDNQIeqbOxRlDqJ-VjAKZAuh2Q/exec';

  const loadReceipt = useCallback(async (idToLoad: string) => {
    setIsSaving(true);
    try {
      const res = await fetch(`${SCRIPT_URL}?id=${idToLoad.trim().toUpperCase()}`);
      const data = await res.json();
      if (!data.error) setFormData(data);
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  }, []);

  useEffect(() => {
    const id = urlParams.get('id');
    if (id) loadReceipt(id);
  }, [loadReceipt]);

  // ENVOI DU RAPPORT DE MÉNAGE
  const submitCleaningReport = async () => {
    setIsSaving(true);
    const payload = {
      action: "CLEANING_REPORT",
      menageId: urlParams.get('menageId'),
      calendarSlug: urlParams.get('slug'),
      dateIntervention: urlParams.get('date'),
      ...cleaningReport
    };
    try {
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
      alert("Rapport de ménage envoyé avec succès !");
      window.close(); // Ferme l'onglet sur mobile
    } catch (e) { alert("Erreur d'envoi"); } finally { setIsSaving(false); }
  };

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : type === 'number' ? (parseFloat(value) || 0) : value }));
  };

  // --- RENDER : FORMULAIRE DE MÉNAGE ---
  if (isCleaningMode) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6 font-sans flex flex-col items-center">
        <div className="w-full max-w-md bg-gray-800 p-6 rounded-lg shadow-xl border border-blue-500/30">
          <h1 className="text-xl font-bold text-blue-400 mb-2 italic">YAMEHOME - MÉNAGE</h1>
          <p className="text-[10px] text-gray-400 mb-6 uppercase tracking-widest">Compte-rendu d'intervention</p>
          
          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Agent (Qui ?)</label>
              <input type="text" className="w-full bg-gray-700 rounded p-3 text-sm outline-none" placeholder="Ex: Madeleine" onChange={(e) => setCleaningReport({...cleaningReport, agent: e.target.value})} />
            </div>

            <div>
              <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">Statut</label>
              <select className="w-full bg-gray-700 rounded p-3 text-sm outline-none" onChange={(e) => setCleaningReport({...cleaningReport, status: e.target.value})}>
                <option value="EFFECTUÉ">✅ MÉNAGE EFFECTUÉ</option>
                <option value="ANOMALIE">⚠️ ANOMALIE SIGNALÉE</option>
                <option value="REPORTÉ">⏳ REPORTÉ</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] text-gray-500 font-bold uppercase block mb-1">État général / Feedback</label>
              <textarea rows={2} className="w-full bg-gray-700 rounded p-3 text-sm outline-none" placeholder="Ex: Maison très propre..." onChange={(e) => setCleaningReport({...cleaningReport, feedback: e.target.value})}></textarea>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-red-400 font-bold uppercase block mb-1">Casse / Dommages</label>
                <textarea rows={2} className="w-full bg-gray-700 rounded p-2 text-[11px] outline-none border border-red-900/30" placeholder="Rien à signaler..." onChange={(e) => setCleaningReport({...cleaningReport, damages: e.target.value})}></textarea>
              </div>
              <div>
                <label className="text-[10px] text-orange-400 font-bold uppercase block mb-1">Maintenance</label>
                <textarea rows={2} className="w-full bg-gray-700 rounded p-2 text-[11px] outline-none border border-orange-900/30" placeholder="Ampoules, peinture..." onChange={(e) => setCleaningReport({...cleaningReport, maintenance: e.target.value})}></textarea>
              </div>
            </div>

            <button onClick={submitCleaningReport} disabled={isSaving || !cleaningReport.agent} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg mt-4 shadow-lg transition-all active:scale-95 disabled:opacity-50">
              {isSaving ? 'ENVOI EN COURS...' : 'VALIDER L\'INTERVENTION'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER : FORMULAIRE DE REÇU (Ton code existant) ---
  if (!isAuthenticated && !isReadOnly) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-gray-800 p-8 rounded-lg border border-gray-700 w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-blue-400 mb-6 italic">YAMEHOME</h1>
          <input type="password" placeholder="Mot de passe" className="w-full bg-gray-700 text-white rounded p-3 mb-4 outline-none" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} autoFocus />
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded">ENTRER</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-900 text-white font-sans text-xs">
      {/* ... Tout le reste de ton App.tsx pour les reçus reste ici ... */}
    </div>
  );
}

export default App;