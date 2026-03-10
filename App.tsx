import React, { useState, useEffect } from 'react';
import { TARIFS, PAYMENT_METHODS, HOSTS, getRateForApartment } from './constants';
import { ReceiptData } from './types';
import ReceiptPreview from './components/ReceiptPreview';

// --- CONFIGURATION SÉCURITÉ ---
const ACCESS_PASSWORD = "Odza2026"; 

function App() {
  // --- ÉTATS ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  
  const generateNewId = () => `RC-${Math.floor(100000 + Math.random() * 900000)}`;

  const getInitialState = (): ReceiptData => ({
    receiptId: generateNewId(),
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    apartmentName: '',
    startDate: '',
    endDate: '',
    isCustomRate: false,
    customLodgingTotal: 0,
    isNegotiatedRate: false,
    negotiatedPricePerNight: 0,
    payments: [{ id: Date.now().toString(), date: new Date().toISOString().split('T')[0], amount: 0, method: 'Espèces' }],
    signature: '',
    hosts: [],
    electricityCharge: false,
    packEco: false,
    observations: ''
  });

  const [formData, setFormData] = useState<ReceiptData>(getInitialState());
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [searchId, setSearchId] = useState('');

  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzfajRxCsKs0CLU4oiA6g5sirHUJHB3QdlJPeKOrjgFFDNQIeqbOxRlDqJ-VjAKZAuh2Q/exec';

  // --- AUTH & TITRE ---
  useEffect(() => {
    if (localStorage.getItem('yame_auth') === 'true') setIsAuthenticated(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) { document.title = "Accès Restreint"; return; }
    const name = `${formData.firstName} ${formData.lastName}`.trim().replace(/\s+/g, '_');
    const apt = formData.apartmentName.split(' - ')[0].replace(/\s+/g, '_');
    const today = new Date();
    const dateStr = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getFullYear()}`;
    document.title = (name || apt) ? `Reçu_${name || 'Client'}_${apt || 'Apt'}_${dateStr}` : "YameHome - Générateur";
  }, [formData.firstName, formData.lastName, formData.apartmentName, isAuthenticated]);

  // --- LOGIQUE DE SAISIE ET EXCLUSION MUTUELLE ---
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      
      // RÈGLE D'EXCLUSION : Si on coche l'un, on décoche l'autre
      if (name === 'isCustomRate') {
        setFormData(prev => ({ ...prev, isCustomRate: checked, isNegotiatedRate: checked ? false : prev.isNegotiatedRate }));
      } else if (name === 'isNegotiatedRate') {
        setFormData(prev => ({ ...prev, isNegotiatedRate: checked, isCustomRate: checked ? false : prev.isCustomRate }));
      } else {
        setFormData(prev => ({ ...prev, [name]: checked }));
      }
    } else if (name === 'hosts') {
      setFormData(prev => ({ ...prev, hosts: Array.from((e.target as HTMLSelectElement).selectedOptions).map(opt => opt.text) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
    }
  };

  // --- AUTRES HANDLERS ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ACCESS_PASSWORD) { setIsAuthenticated(true); localStorage.setItem('yame_auth', 'true'); }
    else { alert("Code incorrect !"); setPasswordInput(''); }
  };

  const handleLogout = () => { localStorage.removeItem('yame_auth'); setIsAuthenticated(false); };
  const resetForm = () => { if (window.confirm("Nouveau reçu ?")) { setFormData(getInitialState()); setSearchId(''); setSaveStatus('idle'); } };
  const handlePrint = () => window.print();

  const saveToSheets = async () => {
    if (!formData.apartmentName || !formData.lastName) { alert("Remplir Nom et Appartement"); return; }
    setIsSaving(true);
    const nights = Math.max(0, Math.ceil((new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) / (1000 * 3600 * 24)));
    const rates = getRateForApartment(formData.apartmentName, nights);
    const pricePerNight = formData.isNegotiatedRate ? (formData.negotiatedPricePerNight || 0) : rates.prix;
    const totalLodging = formData.isCustomRate ? formData.customLodgingTotal : (pricePerNight * nights);
    const grandTotal = totalLodging + rates.caution;
    const totalPaid = (formData.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
    try {
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ receiptId: formData.receiptId, firstName: formData.firstName, lastName: formData.lastName, apartmentName: formData.apartmentName, startDate: formData.startDate, endDate: formData.endDate, grandTotal, totalPaid, remaining: grandTotal - totalPaid, fullData: formData }) });
      setSaveStatus('success'); setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) { setSaveStatus('error'); } finally { setIsSaving(false); }
  };

  const loadReceipt = async () => {
    if (!searchId) return;
    setIsSaving(true);
    try {
      const formattedId = searchId.toUpperCase().startsWith('RC-') ? searchId.toUpperCase() : `RC-${searchId}`;
      const response = await fetch(`${SCRIPT_URL}?id=${formattedId}`);
      const data = await response.json();
      if (data.error) alert("Non trouvé"); else { setFormData(data); alert("Chargé !"); }
    } catch (error) { alert("Erreur"); } finally { setIsSaving(false); }
  };

  const addPayment = () => {
    const newPayment = { id: Date.now().toString(), date: new Date().toISOString().split('T')[0], amount: 0, method: 'Espèces' };
    setFormData(prev => ({ ...prev, payments: [...prev.payments, newPayment] }));
  };

  const updatePayment = (id: string, field: string, value: any) => {
    setFormData(prev => ({ ...prev, payments: prev.payments.map(p => p.id === id ? { ...p, [field]: field === 'amount' ? parseFloat(value) || 0 : value } : p) }));
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 text-center">
        <form onSubmit={handleLogin} className="bg-gray-800 p-8 rounded-xl border border-gray-700 w-full max-w-md">
          <h1 className="text-3xl font-bold text-blue-400 mb-2">YameHome</h1>
          <input type="password" placeholder="Code d'accès" className="w-full bg-gray-700 rounded-lg p-4 text-white border border-gray-600 mb-6 text-center text-xl outline-none" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} autoFocus />
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-4 rounded-lg shadow-lg uppercase tracking-widest">Entrer</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-900">
      <div className="w-full md:w-1/3 text-white p-6 overflow-y-auto h-auto md:h-screen print:hidden shadow-2xl relative">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-xl font-bold text-blue-400 font-bold uppercase">YameHome</h1>
          <div className="flex gap-2">
            <button onClick={resetForm} className="bg-red-500 text-white text-[9px] px-2 py-1 rounded font-bold uppercase">Nouveau</button>
            <button onClick={handleLogout} className="bg-gray-700 text-white text-[9px] px-2 py-1 rounded font-bold uppercase">Quitter</button>
          </div>
        </div>

        <div className="bg-blue-900/20 p-4 rounded border border-blue-500/50 mb-6 font-bold">
          <label className="text-blue-300 text-[10px] font-bold uppercase block mb-2 font-bold uppercase">Charger un reçu</label>
          <div className="flex gap-2">
            <input type="text" placeholder="RC-XXXXXX" className="flex-1 bg-gray-800 rounded p-2 text-xs border border-blue-400/50 outline-none" value={searchId} onChange={(e) => setSearchId(e.target.value)} />
            <button onClick={loadReceipt} className="bg-blue-600 text-white text-[10px] px-3 py-2 rounded font-bold uppercase font-bold">OK</button>
          </div>
        </div>

        <form className="space-y-4 text-sm" onSubmit={(e) => e.preventDefault()}>
          <div className="bg-gray-800 p-4 rounded border border-gray-700 font-bold uppercase font-bold">
            <h3 className="text-gray-400 uppercase text-xs font-bold mb-3 tracking-wider font-bold">Client</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input type="text" name="firstName" value={formData.firstName} placeholder="Prénom" className="w-full bg-gray-700 rounded p-2 border border-gray-600" onChange={handleChange} />
              <input type="text" name="lastName" value={formData.lastName} placeholder="Nom" className="w-full bg-gray-700 rounded p-2 border border-gray-600" onChange={handleChange} />
            </div>
            <input type="tel" name="phone" value={formData.phone} placeholder="Téléphone" className="w-full mb-3 bg-gray-700 rounded p-2 border border-gray-600" onChange={handleChange} />
            <input type="email" name="email" value={formData.email} placeholder="Email" className="w-full bg-gray-700 rounded p-2 border border-gray-600" onChange={handleChange} />
          </div>

          <div className="bg-gray-800 p-4 rounded border border-gray-700 font-bold uppercase font-bold">
            <h3 className="text-gray-400 uppercase text-xs font-bold mb-3 font-bold uppercase font-bold">Réservation</h3>
            <select name="apartmentName" value={formData.apartmentName} className="w-full bg-gray-700 rounded p-2 border border-gray-600 mb-3 text-xs" onChange={handleChange}>
              <option value="">-- Choisir Appartement --</option>
              {Object.keys(TARIFS).map(key => <option key={key} value={key}>{key}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input type="date" name="startDate" value={formData.startDate} className="w-full bg-gray-700 rounded p-2 border border-gray-600 text-xs" onChange={handleChange} />
              <input type="date" name="endDate" value={formData.endDate} className="w-full bg-gray-700 rounded p-2 border border-gray-600 text-xs" onChange={handleChange} />
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded border border-gray-700 font-bold uppercase font-bold">
            <h3 className="text-gray-400 uppercase text-xs font-bold mb-3 font-bold uppercase font-bold">Tarification Spécifique</h3>
            <div className="flex flex-col gap-2 mb-3">
              <label className="flex items-center text-xs text-yellow-400 font-bold">
                <input type="checkbox" name="isCustomRate" checked={formData.isCustomRate} onChange={handleChange} className="mr-2" />
                Tarif Plateforme (Booking/AirBnB)
              </label>
              {formData.isCustomRate && <input type="number" name="customLodgingTotal" value={formData.customLodgingTotal || ''} className="w-full bg-gray-700 rounded p-2 border border-yellow-600 text-yellow-300 text-xs" placeholder="Montant Total Facture" onChange={handleChange} />}
              
              <label className="flex items-center text-xs text-blue-400 font-bold mt-2">
                <input type="checkbox" name="isNegotiatedRate" checked={formData.isNegotiatedRate} onChange={handleChange} className="mr-2" />
                Tarif Négocié (Remise directe)
              </label>
              {formData.isNegotiatedRate && <input type="number" name="negotiatedPricePerNight" value={formData.negotiatedPricePerNight || ''} className="w-full bg-gray-700 rounded p-2 border border-blue-500 text-blue-300 text-xs" placeholder="Prix Négocié par nuit" onChange={handleChange} />}
            </div>

            <div className="mt-4 border-t border-gray-700 pt-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest font-bold uppercase">Versements</span>
                <button type="button" onClick={addPayment} className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase">+ ADD</button>
              </div>
              {formData.payments.map((p, idx) => (
                <div key={p.id} className="bg-gray-700/40 p-2 rounded mb-2 border border-gray-600 relative">
                  {formData.payments.length > 1 && <button onClick={() => { if(formData.payments.length > 1) setFormData(prev => ({...prev, payments: prev.payments.filter(pay => pay.id !== p.id)})); }} className="absolute top-1 right-1 text-red-400 text-[10px]">✕</button>}
                  <div className="grid grid-cols-2 gap-2 mb-1">
                    <input type="date" value={p.date} onChange={(e) => updatePayment(p.id, 'date', e.target.value)} className="bg-gray-800 rounded p-1 text-[10px]" />
                    <input type="number" value={p.amount || ''} placeholder="Montant" onChange={(e) => updatePayment(p.id, 'amount', e.target.value)} className="bg-gray-800 rounded p-1 text-[10px] font-bold text-green-400" />
                  </div>
                  <select value={p.method} onChange={(e) => updatePayment(p.id, 'method', e.target.value)} className="w-full bg-gray-800 rounded p-1 text-[10px]">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded border border-gray-700 font-bold uppercase font-bold">
            <h3 className="text-gray-400 uppercase text-xs font-bold mb-3 tracking-wider font-bold">Options & Signature</h3>
            <div className="flex gap-4 mb-3 text-[10px] font-bold">
              <label className="flex items-center"><input type="checkbox" name="electricityCharge" checked={formData.electricityCharge} onChange={handleChange} className="mr-1" /> Élec client</label>
              <label className="flex items-center"><input type="checkbox" name="packEco" checked={formData.packEco} onChange={handleChange} className="mr-1" /> Pack ECO</label>
            </div>
            <select name="hosts" multiple value={formData.hosts} onChange={handleChange} className="w-full bg-gray-700 rounded p-2 text-[10px] h-20 mb-3 border border-gray-600">
              {HOSTS.map(h => <option key={h.id} value={h.label}>{h.label}</option>)}
            </select>
            <input type="text" name="signature" value={formData.signature} placeholder="Signature (Nom)" className="w-full bg-gray-700 rounded p-2 border border-gray-600 mb-3 text-xs" onChange={handleChange} />
            <textarea name="observations" value={formData.observations} rows={2} placeholder="Observations..." className="w-full bg-gray-700 rounded p-2 border border-gray-600 text-xs" onChange={handleChange}></textarea>
          </div>
        </form>
      </div>

      <div className="w-full md:w-2/3 bg-gray-200 p-2 md:p-8 flex flex-col items-start md:items-center overflow-y-auto h-auto md:h-screen preview-container font-bold">
        <div className="mb-4 no-print flex w-full max-w-[210mm] justify-between items-center print:hidden px-2">
          <div className="flex flex-col">
            <h2 className="text-gray-600 font-bold text-sm">Aperçu Reçu</h2>
            <span className="text-[10px] text-gray-400 font-mono font-bold uppercase">{formData.receiptId}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={saveToSheets} disabled={isSaving} className={`${saveStatus === 'success' ? 'bg-green-600' : 'bg-orange-500'} text-white font-bold py-2 px-3 rounded text-[10px] transition-all disabled:opacity-50 shadow`}>
              {isSaving ? '...' : saveStatus === 'success' ? 'OK' : 'SAUVEGARDER'}
            </button>
            <button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded text-[10px] shadow">IMPRIMER</button>
          </div>
        </div>
        <ReceiptPreview data={formData} />
      </div>
    </div>
  );
}

export default App;