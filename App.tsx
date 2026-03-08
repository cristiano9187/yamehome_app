import React, { useState, useEffect } from 'react';
import { TARIFS, PAYMENT_METHODS, HOSTS, getRateForApartment } from './constants';
import { ReceiptData } from './types';
import ReceiptPreview from './components/ReceiptPreview';

function App() {
  // --- ÉTATS ---
  const [formData, setFormData] = useState<ReceiptData>({
    receiptId: `RC-${Date.now()}`, 
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

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [searchId, setSearchId] = useState(''); // Pour la recherche de reçu

  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzfajRxCsKs0CLU4oiA6g5sirHUJHB3QdlJPeKOrjgFFDNQIeqbOxRlDqJ-VjAKZAuh2Q/exec';

  useEffect(() => {
    const handleStatusChange = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  // --- LOGIQUE GOOGLE SHEETS : SAUVEGARDER ---
  const saveToSheets = async () => {
    if (!formData.apartmentName || !formData.lastName) {
      alert("Veuillez remplir au moins le nom du client et l'appartement.");
      return;
    }
    setIsSaving(true);
    const nights = (new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) / (1000 * 3600 * 24) || 0;
    const rates = getRateForApartment(formData.apartmentName, nights);
    const pricePerNight = formData.isNegotiatedRate ? (formData.negotiatedPricePerNight || 0) : rates.prix;
    const totalLodging = formData.isCustomRate ? formData.customLodgingTotal : (pricePerNight * nights);
    const grandTotal = totalLodging + rates.caution;
    const totalPaid = (formData.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

    const payload = {
      receiptId: formData.receiptId,
      firstName: formData.firstName,
      lastName: formData.lastName,
      apartmentName: formData.apartmentName,
      startDate: formData.startDate,
      endDate: formData.endDate,
      grandTotal: grandTotal,
      totalPaid: totalPaid,
      remaining: grandTotal - totalPaid,
      fullData: formData 
    };

    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  // --- LOGIQUE GOOGLE SHEETS : CHARGER ---
  const loadReceipt = async () => {
    if (!searchId) return;
    setIsSaving(true);
    try {
      const response = await fetch(`${SCRIPT_URL}?id=${searchId.trim()}`);
      const data = await response.json();
      if (data.error) {
        alert("Reçu introuvable");
      } else {
        setFormData(data); // Remplit tout le formulaire d'un coup
        alert("Reçu chargé avec succès !");
      }
    } catch (error) {
      alert("Erreur lors de la récupération du reçu.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- HANDLERS ---
  const addPayment = () => {
    const newPayment = { id: Date.now().toString(), date: new Date().toISOString().split('T')[0], amount: 0, method: 'Espèces' };
    setFormData(prev => ({ ...prev, payments: [...prev.payments, newPayment] }));
  };

  const updatePayment = (id: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      payments: prev.payments.map(p => p.id === id ? { ...p, [field]: field === 'amount' ? parseFloat(value) || 0 : value } : p)
    }));
  };

  const removePayment = (id: string) => {
    if (formData.payments.length > 1) {
      setFormData(prev => ({ ...prev, payments: prev.payments.filter(p => p.id !== id) }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else if (name === 'hosts') {
      const selected = Array.from((e.target as HTMLSelectElement).selectedOptions).map(opt => opt.text);
      setFormData(prev => ({ ...prev, hosts: selected }));
    } else {
      setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-900">
      
      {/* GAUCHE : FORMULAIRE */}
      <div className="w-full md:w-1/3 text-white p-6 overflow-y-auto h-auto md:h-screen print:hidden shadow-2xl">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-400">YameHome Generator</h1>
          <span className={`text-[10px] px-2 py-1 rounded font-bold ${isOffline ? 'bg-orange-500' : 'bg-green-600'}`}>
            {isOffline ? 'OFFLINE' : 'ONLINE'}
          </span>
        </div>

        {/* SECTION RECHERCHE */}
        <div className="bg-blue-900/20 p-4 rounded border border-blue-500/50 mb-6 shadow-inner">
          <label className="text-blue-300 text-[10px] font-bold uppercase block mb-2">Mettre à jour un reçu</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Ex: RC-174..." 
              className="flex-1 bg-gray-800 rounded p-2 text-xs border border-blue-400/50 outline-none focus:border-blue-400"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
            />
            <button onClick={loadReceipt} className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] px-3 py-2 rounded font-bold transition-all">
              CHARGER
            </button>
          </div>
        </div>

        <form className="space-y-4 text-sm" onSubmit={(e) => e.preventDefault()}>
          <div className="bg-gray-800 p-4 rounded border border-gray-700">
            <h3 className="text-gray-400 uppercase text-xs font-bold mb-3">Client</h3>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" name="firstName" value={formData.firstName || ''} placeholder="Prénom" className="w-full bg-gray-700 rounded p-2 border border-gray-600" onChange={handleChange} />
              <input type="text" name="lastName" value={formData.lastName || ''} placeholder="Nom" className="w-full bg-gray-700 rounded p-2 border border-gray-600" onChange={handleChange} />
            </div>
            <input type="tel" name="phone" value={formData.phone || ''} placeholder="Téléphone" className="w-full mt-3 bg-gray-700 rounded p-2 border border-gray-600" onChange={handleChange} />
            <input type="email" name="email" value={formData.email || ''} placeholder="Email" className="w-full mt-3 bg-gray-700 rounded p-2 border border-gray-600" onChange={handleChange} />
          </div>

          <div className="bg-gray-800 p-4 rounded border border-gray-700">
            <h3 className="text-gray-400 uppercase text-xs font-bold mb-3">Réservation</h3>
            <select name="apartmentName" value={formData.apartmentName || ''} className="w-full bg-gray-700 rounded p-2 border border-gray-600 mb-3" onChange={handleChange}>
              <option value="">-- Choisir Appartement --</option>
              {Object.keys(TARIFS).map(key => <option key={key} value={key}>{key}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-gray-400">Arrivée</label>
                <input type="date" name="startDate" value={formData.startDate || ''} className="w-full bg-gray-700 rounded p-2 border border-gray-600" onChange={handleChange} />
              </div>
              <div>
                <label className="text-[10px] text-gray-400">Départ</label>
                <input type="date" name="endDate" value={formData.endDate || ''} className="w-full bg-gray-700 rounded p-2 border border-gray-600" onChange={handleChange} />
              </div>
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded border border-gray-700">
            <h3 className="text-gray-400 uppercase text-xs font-bold mb-3">Tarification</h3>
            <div className="flex items-center mb-2">
              <input type="checkbox" id="isCustomRate" name="isCustomRate" checked={formData.isCustomRate} onChange={(e) => setFormData(prev => ({ ...prev, isCustomRate: e.target.checked, isNegotiatedRate: e.target.checked ? false : prev.isNegotiatedRate }))} className="w-4 h-4 text-blue-600" />
              <label htmlFor="isCustomRate" className="ml-2 text-sm text-yellow-400 font-semibold">Tarif Plateforme (Total Global)</label>
            </div>
            {formData.isCustomRate && (
              <input type="number" name="customLodgingTotal" value={formData.customLodgingTotal || ''} className="w-full bg-gray-700 rounded p-2 border border-yellow-600 text-yellow-300 mb-4" placeholder="Total" onChange={handleChange} />
            )}
            <div className="flex items-center mb-2">
              <input type="checkbox" id="isNegotiatedRate" name="isNegotiatedRate" checked={formData.isNegotiatedRate} onChange={(e) => setFormData(prev => ({ ...prev, isNegotiatedRate: e.target.checked, isCustomRate: e.target.checked ? false : prev.isCustomRate }))} className="w-4 h-4 text-blue-600" />
              <label htmlFor="isNegotiatedRate" className="ml-2 text-sm text-blue-400 font-semibold">Tarif Négocié (Par nuit)</label>
            </div>
            {formData.isNegotiatedRate && (
              <input type="number" name="negotiatedPricePerNight" value={formData.negotiatedPricePerNight || ''} className="w-full bg-gray-700 rounded p-2 border border-blue-500 text-blue-300 mb-4" placeholder="Prix/nuit" onChange={handleChange} />
            )}

            <div className="mt-4 border-t border-gray-700 pt-3">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-gray-400 uppercase text-[10px] font-bold">Versements</h3>
                <button type="button" onClick={addPayment} className="bg-blue-600 text-white text-[10px] px-2 py-1 rounded">+ Ajouter</button>
              </div>
              {formData.payments.map((p, index) => (
                <div key={p.id} className="bg-gray-700/40 p-3 rounded mb-3 border border-gray-600 relative">
                  {formData.payments.length > 1 && <button type="button" onClick={() => removePayment(p.id)} className="absolute top-2 right-2 text-red-400 text-xs">✕</button>}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input type="date" value={p.date} onChange={(e) => updatePayment(p.id, 'date', e.target.value)} className="w-full bg-gray-800 rounded p-1.5 border border-gray-600 text-[11px]" />
                    <input type="number" value={p.amount || ''} placeholder="Montant" onChange={(e) => updatePayment(p.id, 'amount', e.target.value)} className="w-full bg-gray-800 rounded p-1.5 border border-green-600 text-green-400 text-[11px] font-bold" />
                  </div>
                  <select value={p.method} onChange={(e) => updatePayment(p.id, 'method', e.target.value)} className="w-full bg-gray-800 rounded p-1.5 border border-gray-600 text-[11px]">
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded border border-gray-700">
            <h3 className="text-gray-400 uppercase text-xs font-bold mb-3">Options & Signature</h3>
            <div className="space-y-2 mb-3">
              <div className="flex items-center"><input type="checkbox" name="electricityCharge" checked={formData.electricityCharge} className="mr-2" onChange={handleChange} /><label>Électricité charge client</label></div>
              <div className="flex items-center"><input type="checkbox" name="packEco" checked={formData.packEco} className="mr-2" onChange={handleChange} /><label>Pack ECO</label></div>
            </div>
            <select name="hosts" multiple value={formData.hosts} className="w-full bg-gray-700 rounded p-2 border border-gray-600 h-24 mb-3 text-[10px]" onChange={handleChange}>
              {HOSTS.map(h => <option key={h.id} value={h.label}>{h.label}</option>)}
            </select>
            <input type="text" name="signature" value={formData.signature || ''} placeholder="Signature (Nom)" className="w-full bg-gray-700 rounded p-2 border border-gray-600 mb-3" onChange={handleChange} />
            <textarea name="observations" value={formData.observations || ''} rows={2} placeholder="Observations..." className="w-full bg-gray-700 rounded p-2 border border-gray-600" onChange={handleChange}></textarea>
          </div>
        </form>
      </div>

      {/* DROITE : APERÇU */}
      <div className="w-full md:w-2/3 bg-gray-200 p-4 md:p-8 flex flex-col items-center overflow-y-auto h-auto md:h-screen">
        <div className="mb-4 no-print flex w-full max-w-[210mm] justify-between items-center print:hidden">
          <div className="flex flex-col">
            <h2 className="text-gray-600 font-bold">Aperçu en direct (A4)</h2>
            <span className="text-[10px] text-gray-400 font-mono">{formData.receiptId}</span>
          </div>
          <div className="flex gap-3">
            <button onClick={saveToSheets} disabled={isSaving} className={`${saveStatus === 'success' ? 'bg-green-600' : 'bg-orange-500'} text-white font-bold py-2 px-4 rounded shadow flex items-center transition-all disabled:opacity-50`}>
              <span className="mr-2">{isSaving ? '⏳' : '💾'}</span>
              {isSaving ? 'En cours...' : saveStatus === 'success' ? 'Enregistré' : 'Sauvegarder'}
            </button>
            <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow flex items-center">
              Imprimer / PDF
            </button>
          </div>
        </div>
        <ReceiptPreview data={formData} />
      </div>
    </div>
  );
}

export default App;