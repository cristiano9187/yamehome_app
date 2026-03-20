import React, { useState, useEffect, useCallback } from 'react';
import { TARIFS, PAYMENT_METHODS, HOSTS, getRateForApartment } from './constants';
import { ReceiptData } from './types';
import ReceiptPreview from './components/ReceiptPreview';

const ACCESS_PASSWORD = "Odza2026"; 

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

  const [formData, setFormData] = useState<ReceiptData>(getInitialState());
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [searchId, setSearchId] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(sessionStorage.getItem('yame_auth') === 'true');
  const [passwordInput, setPasswordInput] = useState('');
  
  const urlParams = new URLSearchParams(window.location.search);
  const [isCleaningMode, setIsCleaningMode] = useState(urlParams.has('menageId'));
  const [isReadOnly, setIsReadOnly] = useState(urlParams.has('id'));

  const [cleaningReport, setCleaningReport] = useState({
    agent: '', status: 'EFFECTUÉ', feedback: '', damages: '', maintenance: '',
    // Pour le ménage libre
    manualApt: '', manualDate: new Date().toISOString().split('T')[0]
  });

  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzfajRxCsKs0CLU4oiA6g5sirHUJHB3QdlJPeKOrjgFFDNQIeqbOxRlDqJ-VjAKZAuh2Q/exec';

  const loadReceipt = useCallback(async (idToLoad: string) => {
    setIsSaving(true);
    try {
      const res = await fetch(`${SCRIPT_URL}?id=${idToLoad.trim().toUpperCase()}`);
      const data = await response.json();
      if (!data.error) setFormData(data);
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  }, []);

  useEffect(() => {
    const id = urlParams.get('id');
    if (id) loadReceipt(id);
  }, [loadReceipt]);

  const saveToSheets = async () => {
    if (isReadOnly) return;
    if (!formData.apartmentName || !formData.lastName) return alert("Remplir Nom et Appartement");
    const units = TARIFS[formData.apartmentName]?.units || [];
    const finalSlug = (units.length === 1) ? units[0] : formData.calendarSlug;
    if (units.length > 1 && !finalSlug) return alert("Précisez l'unité");

    setIsSaving(true);
    const diffTime = new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime();
    const nights = Math.max(0, Math.ceil(diffTime / (1000 * 3600 * 24)));
    const rates = getRateForApartment(formData.apartmentName, nights);
    const pricePerNight = formData.isNegotiatedRate ? (formData.negotiatedPricePerNight || 0) : rates.prix;
    const totalLodging = formData.isCustomRate ? formData.customLodgingTotal : (pricePerNight * nights);
    const grandTotal = totalLodging + rates.caution;
    const totalPaid = (formData.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

    const payload = {
      receiptId: formData.receiptId, calendarSlug: finalSlug,
      firstName: formData.firstName, lastName: formData.lastName,
      apartmentName: formData.apartmentName, startDate: formData.startDate, endDate: formData.endDate,
      grandTotal, totalPaid, remaining: grandTotal - totalPaid,
      fullData: { ...formData, calendarSlug: finalSlug } 
    };

    try {
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) { setSaveStatus('error'); } finally { setIsSaving(false); }
  };

  const submitCleaningReport = async () => {
    setIsSaving(true);
    const isManual = !urlParams.has('menageId');
    const payload = {
      action: "CLEANING_REPORT",
      menageId: isManual ? `MAN-${Date.now()}` : urlParams.get('menageId'),
      calendarSlug: isManual ? cleaningReport.manualApt : urlParams.get('slug'),
      dateIntervention: isManual ? cleaningReport.manualDate : urlParams.get('date'),
      ...cleaningReport
    };
    try {
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
      alert("Rapport envoyé !");
      window.location.href = window.location.origin + window.location.pathname;
    } catch (e) { alert("Erreur"); } finally { setIsSaving(false); }
  };

  const softDeleteBooking = async () => {
    if (window.confirm("Annuler réservation ?")) {
      setIsSaving(true);
      try {
        await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: "SOFT_DELETE", receiptId: formData.receiptId }) });
        setFormData(getInitialState()); setIsReadOnly(false); alert("Annulé");
      } catch (e) { alert("Erreur"); } finally { setIsSaving(false); }
    }
  };

  const handleChange = (e: any) => {
    if (isReadOnly) return;
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      if (name === 'isCustomRate') setFormData(prev => ({ ...prev, isCustomRate: checked, isNegotiatedRate: checked ? false : prev.isNegotiatedRate }));
      else if (name === 'isNegotiatedRate') setFormData(prev => ({ ...prev, isNegotiatedRate: checked, isCustomRate: checked ? false : prev.isCustomRate }));
      else setFormData(prev => ({ ...prev, [name]: checked }));
    } else setFormData(prev => ({ ...prev, [name]: type === 'number' ? (parseFloat(value) || 0) : value }));
  };

  // --- RENDER : MÉNAGE ---
  if (isCleaningMode) {
    const isManual = !urlParams.has('menageId');
    return (
      <div className="min-h-screen bg-gray-900 text-white p-6 font-sans flex flex-col items-center">
        <div className="w-full max-w-md bg-gray-800 p-6 rounded-lg border border-blue-500/30">
          <h1 className="text-xl font-bold text-blue-400 mb-2 italic">MÉNAGE YAMEHOME</h1>
          <div className="mb-6">
            {isManual ? (
               <div className="space-y-2">
                 <select className="w-full bg-gray-700 rounded p-2 text-xs" onChange={(e) => setCleaningReport({...cleaningReport, manualApt: e.target.value})}>
                    <option value="">-- Choisir Appartement --</option>
                    {Object.values(TARIFS).flatMap(t => t.units || []).map(u => <option key={u} value={u}>{u}</option>)}
                 </select>
                 <input type="date" className="w-full bg-gray-700 rounded p-2 text-xs" value={cleaningReport.manualDate} onChange={(e) => setCleaningReport({...cleaningReport, manualDate: e.target.value})} />
               </div>
            ) : (
              <p className="text-[10px] text-gray-400 uppercase">{urlParams.get('slug')} - {urlParams.get('date')}</p>
            )}
          </div>
          <div className="space-y-4">
            <input type="text" className="w-full bg-gray-700 rounded p-3 text-sm outline-none" placeholder="Agent (Ex: Madeleine)" onChange={(e) => setCleaningReport({...cleaningReport, agent: e.target.value})} />
            <select className="w-full bg-gray-700 rounded p-3 text-sm outline-none" onChange={(e) => setCleaningReport({...cleaningReport, status: e.target.value})}>
              <option value="EFFECTUÉ">✅ EFFECTUÉ</option>
              <option value="ANOMALIE">⚠️ ANOMALIE</option>
              <option value="REPORTÉ">⏳ REPORTÉ</option>
            </select>
            <textarea rows={2} className="w-full bg-gray-700 rounded p-3 text-sm outline-none" placeholder="Feedback..." onChange={(e) => setCleaningReport({...cleaningReport, feedback: e.target.value})}></textarea>
            <textarea rows={2} className="w-full bg-gray-700 rounded p-2 text-[11px] border border-red-900/30 outline-none" placeholder="Dommages ?" onChange={(e) => setCleaningReport({...cleaningReport, damages: e.target.value})}></textarea>
            <textarea rows={2} className="w-full bg-gray-700 rounded p-2 text-[11px] border border-orange-900/30 outline-none" placeholder="Usure ?" onChange={(e) => setCleaningReport({...cleaningReport, maintenance: e.target.value})}></textarea>
            <div className="flex gap-2 mt-4">
               <button onClick={() => setIsCleaningMode(false)} className="bg-gray-600 font-bold py-3 px-4 rounded-lg uppercase text-xs">Annuler</button>
               <button onClick={submitCleaningReport} disabled={isSaving || !cleaningReport.agent || (isManual && !cleaningReport.manualApt)} className="flex-1 bg-blue-600 font-bold py-3 rounded-lg shadow-lg uppercase">{isSaving ? 'ENVOI...' : 'VALIDER'}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER : LOGIN ---
  if (!isAuthenticated && !isReadOnly) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-gray-800 p-8 rounded-lg shadow-2xl border border-gray-700 w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-blue-400 mb-6 italic">YAMEHOME</h1>
          <input type="password" placeholder="Mot de passe" className="w-full bg-gray-700 text-white rounded p-3 mb-4 outline-none" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} autoFocus />
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded">ENTRER</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-900 text-white font-sans text-xs">
      {/* FORMULAIRE GAUCHE */}
      <div className="w-full md:w-1/3 p-6 overflow-y-auto h-auto md:h-screen print:hidden shadow-2xl">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-xl font-bold text-blue-400 italic font-mono uppercase tracking-tighter">YAMEHOME</h1>
          <div className="flex gap-2">
            <button onClick={() => setIsCleaningMode(true)} className="bg-orange-600 text-white text-[9px] px-2 py-1 rounded font-bold uppercase transition-all shadow-md">Ménage Libre</button>
            <button onClick={() => { localStorage.removeItem('yame_draft'); setFormData(getInitialState()); setIsReadOnly(false); setSearchId(''); }} className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded font-bold uppercase transition-all shadow-lg text-[9px]">Nouveau</button>
          </div>
        </div>
        
        {/* ... Le reste du formulaire (Identique à ta version actuelle) ... */}
      </div>
      {/* ... Le reste du rendu ... */}
    </div>
  );
}

export default App;