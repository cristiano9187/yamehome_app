import React, { useState, useEffect } from 'react';
import { TARIFS, PAYMENT_METHODS, HOSTS, getRateForApartment } from './constants';
import { ReceiptData } from './types';
import ReceiptPreview from './components/ReceiptPreview';

function App() {
  // --- ÉTAT INITIAL ---
  const [formData, setFormData] = useState<ReceiptData>({
    receiptId: `RC-${Date.now()}`, // Identifiant unique pour Google Sheets
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
    payments: [
      { 
        id: Date.now().toString(), 
        date: new Date().toISOString().split('T')[0], 
        amount: 0, 
        method: 'Espèces' 
      }
    ],
    signature: '',
    hosts: [],
    electricityCharge: false,
    packEco: false,
    observations: ''
  });

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    const handleStatusChange = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  // --- LOGIQUE DE SAUVEGARDE GOOGLE SHEETS ---
  const saveToSheets = async () => {
    if (!formData.apartmentName || !formData.lastName) {
      alert("Veuillez remplir au moins le nom du client et l'appartement.");
      return;
    }

    setIsSaving(true);
    setSaveStatus('idle');

    // Préparation des calculs financiers pour le tableau de bord Google
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
      fullData: formData // Sauvegarde de l'objet complet pour rechargement futur
    };

    try {
      await fetch('https://script.google.com/macros/s/AKfycbzfajRxCsKs0CLU4oiA6g5sirHUJHB3QdlJPeKOrjgFFDNQIeqbOxRlDqJ-VjAKZAuh2Q/exec', {
        method: 'POST',
        mode: 'no-cors', // Requis pour Google Apps Script
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error("Erreur de sauvegarde:", error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  // --- GESTION DES PAIEMENTS DYNAMIQUES ---
  const addPayment = () => {
    const newPayment = {
      id: Date.now().toString(),
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      method: 'Espèces'
    };
    setFormData(prev => ({ ...prev, payments: [...prev.payments, newPayment] }));
  };

  const updatePayment = (id: string, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      payments: prev.payments.map(p => 
        p.id === id ? { ...p, [field]: field === 'amount' ? parseFloat(value) || 0 : value } : p
      )
    }));
  };

  const removePayment = (id: string) => {
    if (formData.payments.length > 1) {
      setFormData(prev => ({
        ...prev,
        payments: prev.payments.filter(p => p.id !== id)
      }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else if (name === 'hosts') {
      const select = e.target as HTMLSelectElement;
      const selected = Array.from(select.selectedOptions).map(opt => opt.text);
      setFormData(prev => ({ ...prev, hosts: selected }));
    } else {
      setFormData(prev => ({ 
        ...prev, 
        [name]: type === 'number' ? parseFloat(value) || 0 : value 
      }));
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      
      {/* GAUCHE : FORMULAIRE */}
      <div className="w-full md:w-1/3 bg-gray-900 text-white p-6 overflow-y-auto h-auto md:h-screen print:hidden">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-400">YameHome Generator</h1>
          <span className={`text-xs px-2 py-1 rounded ${isOffline ? 'bg-orange-500' : 'bg-green-600'}`}>
            {isOffline ? 'Hors Ligne' : 'En Ligne'}
          </span>
        </div>

        <form className="space-y-4 text-sm" onSubmit={(e) => e.preventDefault()}>
          <div className="bg-gray-800 p-4 rounded border border-gray-700">
            <h3 className="text-gray-400 uppercase text-xs font-bold mb-3">Client</h3>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" name="firstName" placeholder="Prénom" className="w-full bg-gray-700 rounded p-2 border border-gray-600" onChange={handleChange} />
              <input type="text" name="lastName" placeholder="Nom" className="w-full bg-gray-700 rounded p-2 border border-gray-600" onChange={handleChange} />
            </div>
            <input type="tel" name="phone" placeholder="Téléphone" className="w-full mt-3 bg-gray-700 rounded p-2 border border-gray-600" onChange={handleChange} />
            <input type="email" name="email" placeholder="Email" className="w-full mt-3 bg-gray-700 rounded p-2 border border-gray-600" onChange={handleChange} />
          </div>

          <div className="bg-gray-800 p-4 rounded border border-gray-700">
            <h3 className="text-gray-400 uppercase text-xs font-bold mb-3">Réservation</h3>
            <select name="apartmentName" className="w-full bg-gray-700 rounded p-2 border border-gray-600 mb-3" onChange={handleChange}>
              <option value="">-- Choisir Appartement --</option>
              {Object.keys(TARIFS).map(key => <option key={key} value={key}>{key}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400">Arrivée</label>
                <input type="date" name="startDate" className="w-full bg-gray-700 rounded p-2 border border-gray-600" onChange={handleChange} />
              </div>
              <div>
                <label className="text-xs text-gray-400">Départ</label>
                <input type="date" name="endDate" className="w-full bg-gray-700 rounded p-2 border border-gray-600" onChange={handleChange} />
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
              <div className="mb-4 pl-6">
                <input type="number" name="customLodgingTotal" className="w-full bg-gray-700 rounded p-2 border border-yellow-600 text-yellow-300" placeholder="Total Séjour" onChange={handleChange} />
              </div>
            )}

            <div className="flex items-center mb-2">
              <input type="checkbox" id="isNegotiatedRate" name="isNegotiatedRate" checked={formData.isNegotiatedRate} onChange={(e) => setFormData(prev => ({ ...prev, isNegotiatedRate: e.target.checked, isCustomRate: e.target.checked ? false : prev.isCustomRate }))} className="w-4 h-4 text-blue-600" />
              <label htmlFor="isNegotiatedRate" className="ml-2 text-sm text-blue-400 font-semibold">Tarif Négocié (Par nuit)</label>
            </div>

            {formData.isNegotiatedRate && (
              <div className="mb-4 pl-6">
                <input type="number" name="negotiatedPricePerNight" className="w-full bg-gray-700 rounded p-2 border border-blue-500 text-blue-300" placeholder="Prix par nuit" onChange={handleChange} />
              </div>
            )}

            <div className="mt-4 border-t border-gray-700 pt-3">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-gray-400 uppercase text-[10px] font-bold">Versements</h3>
                <button type="button" onClick={addPayment} className="bg-blue-600 text-white text-[10px] px-2 py-1 rounded">+ Ajouter</button>
              </div>

              {formData.payments.map((p, index) => (
                <div key={p.id} className="bg-gray-700/40 p-3 rounded mb-3 border border-gray-600 relative">
                  {formData.payments.length > 1 && (
                    <button type="button" onClick={() => removePayment(p.id)} className="absolute top-2 right-2 text-red-400 text-xs">✕</button>
                  )}
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
              <div className="flex items-center"><input type="checkbox" name="electricityCharge" className="mr-2" onChange={handleChange} /><label>Électricité charge client</label></div>
              <div className="flex items-center"><input type="checkbox" name="packEco" className="mr-2" onChange={handleChange} /><label>Pack ECO</label></div>
            </div>
            <select name="hosts" multiple className="w-full bg-gray-700 rounded p-2 border border-gray-600 h-24 mb-3 text-xs" onChange={handleChange}>
              {HOSTS.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
            </select>
            <input type="text" name="signature" placeholder="Signature (Nom)" className="w-full bg-gray-700 rounded p-2 border border-gray-600 mb-3" onChange={handleChange} />
            <textarea name="observations" rows={2} placeholder="Observations supplémentaires..." className="w-full bg-gray-700 rounded p-2 border border-gray-600" onChange={handleChange}></textarea>
          </div>
        </form>
      </div>

      {/* DROITE : APERÇU ET BOUTONS ACTIONS */}
      <div className="w-full md:w-2/3 bg-gray-200 p-4 md:p-8 flex flex-col items-center overflow-y-auto h-auto md:h-screen">
        <div className="mb-4 no-print flex w-full max-w-[210mm] justify-between items-center print:hidden">
          <h2 className="text-gray-600 font-semibold">Aperçu en direct (A4)</h2>
          
          <div className="flex gap-3">
            <button 
              onClick={saveToSheets} 
              disabled={isSaving}
              className={`${
                saveStatus === 'success' ? 'bg-green-600' : saveStatus === 'error' ? 'bg-red-600' : 'bg-orange-500 hover:bg-orange-600'
              } text-white font-bold py-2 px-4 rounded shadow flex items-center transition-all disabled:opacity-50`}
            >
              <span className="mr-2">{isSaving ? '⏳' : saveStatus === 'success' ? '✅' : '💾'}</span>
              {isSaving ? 'Enregistrement...' : saveStatus === 'success' ? 'Enregistré' : 'Sauvegarder'}
            </button>

            <button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
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