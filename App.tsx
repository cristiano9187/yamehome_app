import React, { useState, useEffect, useCallback } from 'react';
import { TARIFS, PAYMENT_METHODS, HOSTS, getRateForApartment } from './constants';
import { ReceiptData } from './types';
import ReceiptPreview from './components/ReceiptPreview';

// --- CONFIGURATION SÉCURITÉ ---
const ACCESS_PASSWORD = "Odza2026"; // ⚠️ REMPLACE PAR TON VRAI PASS

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
  
  const urlParams = new URLSearchParams(window.location.search);
  const [isCleaningMode, setIsCleaningMode] = useState(urlParams.has('menageId'));
  const [isReadOnly, setIsReadOnly] = useState(urlParams.has('id'));

  const [cleaningReport, setCleaningReport] = useState({
    agent: '', status: 'EFFECTUÉ', feedback: '', damages: '', maintenance: '',
    manualApt: '', manualDate: new Date().toISOString().split('T')[0]
  });

  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzfajRxCsKs0CLU4oiA6g5sirHUJHB3QdlJPeKOrjgFFDNQIeqbOxRlDqJ-VjAKZAuh2Q/exec';

  // --- 1. FONCTION DE CONNEXION ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ACCESS_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('yame_auth', 'true');
    } else {
      alert("Mot de passe incorrect");
    }
  };

  // --- 2. GESTION DES CHANGEMENTS SAISIE ---
  const handleChange = (e: any) => {
    if (isReadOnly) return;
    const { name, value, type, checked } = e.target;
    if (type === 'checkbox') {
      if (name === 'isCustomRate') setFormData(prev => ({ ...prev, isCustomRate: checked, isNegotiatedRate: checked ? false : prev.isNegotiatedRate }));
      else if (name === 'isNegotiatedRate') setFormData(prev => ({ ...prev, isNegotiatedRate: checked, isCustomRate: checked ? false : prev.isCustomRate }));
      else setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: type === 'number' ? (parseFloat(value) || 0) : value }));
    }
  };

  // --- 3. RÉSEAU : CHARGER UN REÇU ---
  const loadReceipt = useCallback(async (idToLoad: string) => {
    setIsSaving(true);
    try {
      const formattedId = idToLoad.toUpperCase().startsWith('RC-') ? idToLoad.toUpperCase() : `RC-${idToLoad}`;
      const res = await fetch(`${SCRIPT_URL}?id=${formattedId.trim()}`);
      const data = await res.json();
      if (!data.error) setFormData(data);
      else alert("Reçu non trouvé");
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  }, []);

  useEffect(() => {
    const id = urlParams.get('id');
    if (id) { setIsReadOnly(true); loadReceipt(id); }
  }, [loadReceipt]);

  // --- 4. RÉSEAU : SAUVEGARDER REÇU ---
  const saveToSheets = async () => {
    if (isReadOnly) return;
    if (!formData.apartmentName || !formData.lastName) return alert("Nom et Appartement requis");
    
    const units = TARIFS[formData.apartmentName]?.units || [];
    const finalSlug = units.length === 1 ? units[0] : formData.calendarSlug;
    if (units.length > 1 && !finalSlug) return alert("Précisez l'unité pour le calendrier");

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

  // --- 5. RÉSEAU : ANNULER RÉSERVATION ---
  const softDeleteBooking = async () => {
    if (window.confirm("Annuler cette réservation et libérer le calendrier ?")) {
      setIsSaving(true);
      try {
        await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ action: "SOFT_DELETE", receiptId: formData.receiptId }) });
        setFormData(getInitialState()); setIsReadOnly(false); alert("Annulé");
      } catch (e) { alert("Erreur"); } finally { setIsSaving(false); }
    }
  };

  // --- 6. RÉSEAU : RAPPORT MÉNAGE ---
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

  // --- RENDU : ÉCRAN MÉNAGE ---
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
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">{urlParams.get('slug')} - {urlParams.get('date')}</p>
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
            <div className="grid grid-cols-2 gap-3">
              <textarea rows={2} className="bg-gray-700 rounded p-2 text-[11px] border border-red-900/30" placeholder="Casse ?" onChange={(e) => setCleaningReport({...cleaningReport, damages: e.target.value})}></textarea>
              <textarea rows={2} className="bg-gray-700 rounded p-2 text-[11px] border border-orange-900/30" placeholder="Usure ?" onChange={(e) => setCleaningReport({...cleaningReport, maintenance: e.target.value})}></textarea>
            </div>
            <div className="flex gap-2 mt-4">
               <button onClick={() => setIsCleaningMode(false)} className="bg-gray-600 font-bold py-3 px-4 rounded-lg text-xs uppercase">Retour</button>
               <button onClick={submitCleaningReport} disabled={isSaving || !cleaningReport.agent} className="flex-1 bg-blue-600 font-bold py-3 rounded-lg shadow-lg uppercase">{isSaving ? 'ENVOI...' : 'VALIDER'}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDU : ÉCRAN LOGIN ---
  if (!isAuthenticated && !isReadOnly) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="bg-gray-800 p-8 rounded-lg shadow-2xl border border-gray-700 w-full max-w-sm text-center font-sans">
          <h1 className="text-2xl font-bold text-blue-400 mb-6 italic">YAMEHOME</h1>
          <input type="password" placeholder="Mot de passe" className="w-full bg-gray-700 text-white rounded p-3 mb-4 outline-none border border-gray-600 focus:border-blue-500" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} autoFocus />
          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded uppercase tracking-widest transition-all">Entrer</button>
        </form>
      </div>
    );
  }

  // --- RENDU : FORMULAIRE PRINCIPAL ---
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-900 text-white font-sans text-xs">
      <div className="w-full md:w-1/3 p-6 overflow-y-auto h-auto md:h-screen print:hidden shadow-2xl border-r border-gray-800">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-xl font-bold text-blue-400 italic font-mono uppercase tracking-tighter">YAMEHOME</h1>
          <div className="flex gap-2">
            <button onClick={() => window.location.href = window.location.origin + window.location.pathname} className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded font-bold text-[9px]">Quitter</button>
            <button onClick={() => { setFormData(getInitialState()); setIsReadOnly(false); setSearchId(''); }} className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded font-bold text-[9px] shadow-lg">Nouveau</button>
          </div>
        </div>

        <div className="bg-blue-900/20 p-4 rounded border border-blue-500/30 mb-6 flex flex-col gap-2">
           <button onClick={() => setIsCleaningMode(true)} className="w-full bg-orange-600 text-white font-bold py-2 rounded text-[10px] uppercase shadow-md mb-2">Ménage Libre 🧹</button>
           <div className="flex gap-2">
            <input type="text" placeholder="Rechercher ID..." className="flex-1 bg-gray-800 rounded p-2 border border-blue-400/50 outline-none text-xs" value={searchId} onChange={(e) => setSearchId(e.target.value)} />
            <button onClick={() => loadReceipt(searchId)} className="bg-blue-600 px-3 py-2 rounded font-bold uppercase text-[10px]">OK</button>
           </div>
        </div>

        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="bg-gray-800 p-4 rounded border border-gray-700">
            <h3 className="uppercase font-bold mb-3 border-b border-gray-700 pb-1 italic text-center">Client</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input disabled={isReadOnly} type="text" name="firstName" value={formData.firstName} placeholder="Prénom" className="w-full bg-gray-700 rounded p-2 border border-gray-600 text-xs" onChange={handleChange} />
              <input disabled={isReadOnly} type="text" name="lastName" value={formData.lastName} placeholder="Nom" className="w-full bg-gray-700 rounded p-2 border border-gray-600 text-xs" onChange={handleChange} />
            </div>
            <input disabled={isReadOnly} type="tel" name="phone" value={formData.phone} placeholder="Téléphone" className="w-full bg-gray-700 rounded p-2 border border-gray-600 text-xs" onChange={handleChange} />
          </div>

          <div className="bg-gray-800 p-4 rounded border border-gray-700">
            <h3 className="uppercase font-bold mb-3 border-b border-gray-700 pb-1 italic text-center text-gray-400">Logement</h3>
            <select disabled={isReadOnly} name="apartmentName" value={formData.apartmentName} className="w-full bg-gray-700 rounded p-2 border border-gray-600 mb-3 text-xs" onChange={handleChange}>
              <option value="">-- Choisir --</option>
              {Object.keys(TARIFS).map(key => <option key={key} value={key}>{key}</option>)}
            </select>
            {TARIFS[formData.apartmentName]?.units && TARIFS[formData.apartmentName].units!.length > 1 && (
              <div className="mb-3 p-2 bg-blue-900/30 border border-blue-500/50 rounded">
                <select disabled={isReadOnly} name="calendarSlug" value={formData.calendarSlug} onChange={handleChange} className="w-full bg-gray-700 p-1.5 rounded border border-blue-400">
                  <option value="">-- Préciser l'unité --</option>
                  {TARIFS[formData.apartmentName].units!.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <input disabled={isReadOnly} type="date" name="startDate" value={formData.startDate} className="bg-gray-700 rounded p-2 border border-gray-600" onChange={handleChange} />
              <input disabled={isReadOnly} type="date" name="endDate" value={formData.endDate} className="bg-gray-700 rounded p-2 border border-gray-600" onChange={handleChange} />
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded border border-gray-700">
            <h3 className="uppercase font-bold mb-3 border-b border-gray-700 pb-1 italic text-center">Tarification</h3>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center text-[10px]"><input disabled={isReadOnly} type="checkbox" name="isCustomRate" checked={formData.isCustomRate} onChange={handleChange} className="mr-1" /> Platef.</label>
              <label className="flex items-center text-[10px]"><input disabled={isReadOnly} type="checkbox" name="isNegotiatedRate" checked={formData.isNegotiatedRate} onChange={handleChange} className="mr-1" /> Négocié</label>
            </div>
            {formData.isCustomRate && <input disabled={isReadOnly} type="number" name="customLodgingTotal" value={formData.customLodgingTotal || ''} className="w-full bg-gray-700 rounded p-2 border border-yellow-600 text-yellow-300 mb-3" placeholder="Total" onChange={handleChange} />}
            {formData.isNegotiatedRate && <input disabled={isReadOnly} type="number" name="negotiatedPricePerNight" value={formData.negotiatedPricePerNight || ''} className="w-full bg-gray-700 rounded p-2 border border-blue-500 text-blue-300 mb-3" placeholder="Prix nuit" onChange={handleChange} />}
            <div className="mt-4 border-t border-gray-700 pt-3 text-[10px]">
              <div className="flex justify-between items-center mb-2"><span className="font-bold text-gray-400 uppercase">Versements</span>{!isReadOnly && <button type="button" onClick={() => setFormData(prev => ({...prev, payments: [...prev.payments, { id: Date.now().toString(), date: new Date().toISOString().split('T')[0], amount: 0, method: 'Espèces' }]}))} className="bg-blue-600 text-white px-2 py-0.5 rounded font-bold shadow">+ Add</button>}</div>
              {formData.payments.map((p) => (
                <div key={p.id} className="bg-gray-700/40 p-2 rounded mb-2 border border-gray-600 relative">
                   {!isReadOnly && formData.payments.length > 1 && <button onClick={() => setFormData(prev => ({...prev, payments: prev.payments.filter(x => x.id !== p.id)}))} className="absolute top-1 right-1 text-red-400 font-bold px-1 z-10">✕</button>}
                   <input disabled={isReadOnly} type="date" value={p.date} onChange={(e) => setFormData(prev => ({...prev, payments: prev.payments.map(x => x.id === p.id ? {...x, date: e.target.value} : x)}))} className="bg-gray-800 rounded p-1 mb-1 w-full border-none" />
                   <div className="flex gap-2">
                    <input disabled={isReadOnly} type="number" value={p.amount || ''} placeholder="Montant" onChange={(e) => setFormData(prev => ({...prev, payments: prev.payments.map(x => x.id === p.id ? {...x, amount: parseFloat(e.target.value) || 0} : x)}))} className="bg-gray-800 rounded p-1 flex-1 font-bold text-green-400 border-none outline-none" />
                    <select disabled={isReadOnly} value={p.method} onChange={(e) => setFormData(prev => ({...prev, payments: prev.payments.map(x => x.id === p.id ? {...x, method: e.target.value} : x)}))} className="bg-gray-800 rounded p-1 flex-1 border-none">{PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}</select>
                   </div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-gray-800 p-4 rounded border border-gray-700 shadow-lg">
            <div className="flex gap-4 mb-4">
              <label className="text-[10px] cursor-pointer"><input disabled={isReadOnly} type="checkbox" name="electricityCharge" checked={formData.electricityCharge} onChange={handleChange} className="mr-2" />Élec client</label>
              <label className="text-[10px] cursor-pointer"><input disabled={isReadOnly} type="checkbox" name="packEco" checked={formData.packEco} onChange={handleChange} className="mr-2" />Pack ECO</label>
            </div>
            <h3 className="uppercase font-bold mb-1 text-blue-400 text-[10px]">Hôtes (Contacts)</h3>
            <select disabled={isReadOnly} name="hosts" multiple value={formData.hosts || []} onChange={handleChange} className="w-full bg-gray-700 rounded p-2 text-[10px] h-20 mb-3 border border-gray-600 outline-none text-gray-300">
              {HOSTS.map(h => <option key={h.id} value={h.label}>{h.label}</option>)}
            </select>
            <input disabled={isReadOnly} type="text" name="signature" value={formData.signature} placeholder="Signature" className="w-full bg-gray-700 rounded p-2 border border-gray-600 mb-3 outline-none" onChange={handleChange} />
            <textarea disabled={isReadOnly} name="observations" value={formData.observations} rows={2} placeholder="Note..." className="w-full bg-gray-700 rounded p-2 border border-gray-600 outline-none text-[10px]" onChange={handleChange}></textarea>
          </div>
        </form>
      </div>

      {/* APERÇU DROITE */}
      <div className="w-full md:w-2/3 bg-gray-200 p-2 md:p-8 flex flex-col items-start md:items-center overflow-y-auto h-auto md:h-screen preview-container">
        <div className="mb-4 no-print flex w-full max-w-[210mm] justify-between items-center print:hidden px-2">
          <div className="flex flex-col"><h2 className="text-gray-600 font-bold text-sm uppercase">Détails Reçu</h2><span className="text-[10px] text-gray-400 font-mono font-bold">{formData.receiptId}</span></div>
          <div className="flex gap-2">
            {!isReadOnly && (
              <>
                <button onClick={softDeleteBooking} className="bg-red-600 text-white font-bold py-2 px-3 rounded shadow uppercase text-[10px]">Annuler</button>
                <button onClick={saveToSheets} disabled={isSaving} className={`${saveStatus === 'success' ? 'bg-green-600' : 'bg-orange-600'} text-white font-bold py-2 px-3 rounded shadow uppercase text-[10px] transition-all`}>
                  {isSaving ? '...' : saveStatus === 'success' ? 'OK' : 'SAUVEGARDER'}
                </button>
              </>
            )}
            <button onClick={() => window.print()} className="bg-blue-600 text-white font-bold py-2 px-3 rounded shadow uppercase text-[10px]">PDF</button>
          </div>
        </div>
        <ReceiptPreview data={formData} />
      </div>
    </div>
  );
}

export default App;