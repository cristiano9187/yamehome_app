import React, { useState, useEffect, useCallback } from 'react';
import { TARIFS, PAYMENT_METHODS, HOSTS, getRateForApartment } from './constants';
import { ReceiptData } from './types';
import ReceiptPreview from './components/ReceiptPreview';

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
  const [isReadOnly, setIsReadOnly] = useState(new URLSearchParams(window.location.search).has('id'));

  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzfajRxCsKs0CLU4oiA6g5sirHUJHB3QdlJPeKOrjgFFDNQIeqbOxRlDqJ-VjAKZAuh2Q/exec';

  const loadReceipt = useCallback(async (idToLoad: string, setReadOnly: boolean) => {
    if (!idToLoad) return;
    setIsSaving(true);
    setIsReadOnly(setReadOnly);
    const formattedId = idToLoad.toUpperCase().startsWith('RC-') ? idToLoad.toUpperCase() : `RC-${idToLoad}`;
    try {
      const response = await fetch(`${SCRIPT_URL}?id=${formattedId.trim()}`);
      const data = await response.json();
      if (data.error) { alert("Non trouvé"); setIsReadOnly(false); }
      else setFormData(data);
    } catch (e) { alert("Erreur réseau"); setIsReadOnly(false); } finally { setIsSaving(false); }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get('id');
    if (idFromUrl) loadReceipt(idFromUrl, true);
  }, [loadReceipt]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    if (isReadOnly) return;
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const isChecked = (e.target as HTMLInputElement).checked;
        if (name === 'isCustomRate') setFormData(prev => ({ ...prev, isCustomRate: isChecked, isNegotiatedRate: isChecked ? false : prev.isNegotiatedRate }));
        else if (name === 'isNegotiatedRate') setFormData(prev => ({ ...prev, isNegotiatedRate: isChecked, isCustomRate: isChecked ? false : prev.isCustomRate }));
        else setFormData(prev => ({ ...prev, [name]: isChecked }));
    } else setFormData(prev => ({ ...prev, [name]: type === 'number' ? (parseFloat(value) || 0) : value }));
  };

  const saveToSheets = async () => {
    if (isReadOnly) return;
    if (!formData.apartmentName || !formData.lastName) return alert("Remplir Nom et Appartement");
    const units = TARIFS[formData.apartmentName]?.units || [];
    const finalSlug = units.length === 1 ? units[0] : formData.calendarSlug;
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

  const softDeleteBooking = async () => {
    if (window.confirm("❗ ANNULATION : Voulez-vous retirer cette réservation du calendrier ?")) {
      setIsSaving(true);
      try {
        await fetch(SCRIPT_URL, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify({ action: "SOFT_DELETE", receiptId: formData.receiptId })
        });
        alert("Réservation retirée.");
        setFormData(getInitialState());
        setIsReadOnly(false);
        setSearchId('');
      } catch (e) { alert("Erreur lors de l'annulation."); } finally { setIsSaving(false); }
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-900 text-white font-sans text-xs">
      <div className="w-full md:w-1/3 p-6 overflow-y-auto h-auto md:h-screen print:hidden shadow-2xl border-r border-gray-800">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-xl font-bold text-blue-400 italic font-mono uppercase tracking-tighter">YAMEHOME</h1>
          <div className="flex gap-2">
            <button onClick={() => window.location.href = window.location.origin + window.location.pathname} className="bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded font-bold uppercase transition-all">Quitter</button>
            <button onClick={() => { setFormData(getInitialState()); setIsReadOnly(false); setSearchId(''); }} className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded font-bold uppercase transition-all shadow-lg">Nouveau</button>
          </div>
        </div>

        <div className="bg-blue-900/20 p-4 rounded border border-blue-500/30 mb-6">
          <div className="flex gap-2">
            <input type="text" placeholder="Rechercher ID..." className="flex-1 bg-gray-800 rounded p-2 border border-blue-400/50 outline-none" value={searchId} onChange={(e) => setSearchId(e.target.value)} />
            <button onClick={() => loadReceipt(searchId, false)} className="bg-blue-600 px-3 py-2 rounded font-bold uppercase hover:bg-blue-700">OK</button>
          </div>
        </div>

        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <div className="bg-gray-800 p-4 rounded border border-gray-700 shadow-sm">
            <h3 className="uppercase font-bold mb-3 border-b border-gray-700 pb-1 italic text-center text-gray-400">Client</h3>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <input disabled={isReadOnly} type="text" name="firstName" value={formData.firstName} placeholder="Prénom" className="w-full bg-gray-700 rounded p-2 border border-gray-600 outline-none disabled:opacity-70" onChange={handleChange} />
              <input disabled={isReadOnly} type="text" name="lastName" value={formData.lastName} placeholder="Nom" className="w-full bg-gray-700 rounded p-2 border border-gray-600 outline-none disabled:opacity-70" onChange={handleChange} />
            </div>
            <input disabled={isReadOnly} type="tel" name="phone" value={formData.phone} placeholder="Téléphone" className="w-full bg-gray-700 rounded p-2 border border-gray-600 outline-none disabled:opacity-70" onChange={handleChange} />
          </div>

          <div className="bg-gray-800 p-4 rounded border border-gray-700 shadow-sm">
            <h3 className="uppercase font-bold mb-3 border-b border-gray-700 pb-1 italic text-center text-gray-400">Réservation</h3>
            <select disabled={isReadOnly} name="apartmentName" value={formData.apartmentName} className="w-full bg-gray-700 rounded p-2 border border-gray-600 mb-3 text-xs outline-none disabled:opacity-70" onChange={handleChange}>
              <option value="">-- Choisir Appartement --</option>
              {Object.keys(TARIFS).map(key => <option key={key} value={key}>{key}</option>)}
            </select>
            {TARIFS[formData.apartmentName]?.units && TARIFS[formData.apartmentName].units!.length > 1 && (
              <div className="mb-3 p-2 bg-blue-900/30 border border-blue-500/50 rounded">
                <select disabled={isReadOnly} name="calendarSlug" value={formData.calendarSlug} onChange={handleChange} className="w-full bg-gray-700 p-1.5 rounded border border-blue-400 outline-none disabled:opacity-70">
                  <option value="">-- Préciser l'unité --</option>
                  {TARIFS[formData.apartmentName].units!.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <input disabled={isReadOnly} type="date" name="startDate" value={formData.startDate} className="bg-gray-700 rounded p-2 border border-gray-600 disabled:opacity-70" onChange={handleChange} />
              <input disabled={isReadOnly} type="date" name="endDate" value={formData.endDate} className="bg-gray-700 rounded p-2 border border-gray-600 disabled:opacity-70" onChange={handleChange} />
            </div>
          </div>

          <div className="bg-gray-800 p-4 rounded border border-gray-700 shadow-sm">
            <h3 className="uppercase font-bold mb-3 border-b border-gray-700 pb-1 italic text-center text-gray-400">Tarification</h3>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center cursor-pointer"><input disabled={isReadOnly} type="checkbox" name="isCustomRate" checked={formData.isCustomRate} onChange={handleChange} className="mr-1" /> Plateforme</label>
              <label className="flex items-center cursor-pointer"><input disabled={isReadOnly} type="checkbox" name="isNegotiatedRate" checked={formData.isNegotiatedRate} onChange={handleChange} className="mr-1" /> Négocié</label>
            </div>
            
            {formData.isCustomRate && <input disabled={isReadOnly} type="number" name="customLodgingTotal" value={formData.customLodgingTotal || ''} className="w-full bg-gray-700 rounded p-2 border border-yellow-600 text-yellow-300 mb-3 outline-none disabled:opacity-70" placeholder="Montant plateforme" onChange={handleChange} />}
            {formData.isNegotiatedRate && <input disabled={isReadOnly} type="number" name="negotiatedPricePerNight" value={formData.negotiatedPricePerNight || ''} className="w-full bg-gray-700 rounded p-2 border border-blue-500 text-blue-300 mb-3 outline-none disabled:opacity-70" placeholder="Prix nuit négocié" onChange={handleChange} />}
            
            <div className="mt-4 border-t border-gray-700 pt-3">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-gray-400 uppercase">Versements</span>
                {!isReadOnly && <button type="button" onClick={() => setFormData(prev => ({...prev, payments: [...prev.payments, { id: Date.now().toString(), date: new Date().toISOString().split('T')[0], amount: 0, method: 'Espèces' }]}))} className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px] font-bold uppercase shadow">+ Add</button>}
              </div>
              {formData.payments.map((p) => (
                <div key={p.id} className="bg-gray-700/40 p-2 rounded mb-2 border border-gray-600 text-[10px] relative">
                   {!isReadOnly && formData.payments.length > 1 && <button onClick={() => setFormData(prev => ({...prev, payments: prev.payments.filter(x => x.id !== p.id)}))} className="absolute top-1 right-1 text-red-400 font-bold px-1 z-10 text-[12px]">✕</button>}
                   <input disabled={isReadOnly} type="date" value={p.date} onChange={(e) => setFormData(prev => ({...prev, payments: prev.payments.map(x => x.id === p.id ? {...x, date: e.target.value} : x)}))} className="bg-gray-800 rounded p-1 mb-1 w-full border-none outline-none disabled:opacity-70" />
                   <div className="flex gap-2">
                    <input disabled={isReadOnly} type="number" value={p.amount || ''} placeholder="Montant" onChange={(e) => setFormData(prev => ({...prev, payments: prev.payments.map(x => x.id === p.id ? {...x, amount: parseFloat(e.target.value) || 0} : x)}))} className="bg-gray-800 rounded p-1 flex-1 font-bold text-green-400 outline-none border-none disabled:opacity-70" />
                    <select disabled={isReadOnly} value={p.method} onChange={(e) => setFormData(prev => ({...prev, payments: prev.payments.map(x => x.id === p.id ? {...x, method: e.target.value} : x)}))} className="bg-gray-800 rounded p-1 flex-1 outline-none border-none disabled:opacity-70">{PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}</select>
                   </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-gray-800 p-4 rounded border border-gray-700 shadow-lg">
            <select disabled={isReadOnly} name="hosts" multiple value={formData.hosts} onChange={handleChange} className="w-full bg-gray-700 rounded p-2 text-[10px] h-20 mb-3 border border-gray-600 outline-none disabled:opacity-70 text-gray-300">
              {HOSTS.map(h => <option key={h.id} value={h.label}>{h.label}</option>)}
            </select>
            <input disabled={isReadOnly} type="text" name="signature" value={formData.signature} placeholder="Signature" className="w-full bg-gray-700 rounded p-2 border border-gray-600 mb-3 outline-none shadow-inner disabled:opacity-70" onChange={handleChange} />
            <textarea disabled={isReadOnly} name="observations" value={formData.observations} rows={2} placeholder="Note..." className="w-full bg-gray-700 rounded p-2 border border-gray-600 text-xs outline-none disabled:opacity-70" onChange={handleChange}></textarea>
          </div>
        </form>
      </div>

      <div className="w-full md:w-2/3 bg-gray-200 p-2 md:p-8 flex flex-col items-start md:items-center overflow-y-auto h-auto md:h-screen preview-container">
        <div className="mb-4 no-print flex w-full max-w-[210mm] justify-between items-center print:hidden px-2">
          <div className="flex flex-col"><h2 className="text-gray-600 font-bold text-sm uppercase">Détails Reçu</h2><span className="text-[10px] text-gray-400 font-mono font-bold uppercase">{formData.receiptId}</span></div>
          <div className="flex gap-2">
            {/* LES DEUX BOUTONS DE POUVOIR SONT CACHÉS SI isReadOnly EST VRAI */}
            {!isReadOnly && (
              <>
                <button onClick={softDeleteBooking} disabled={isSaving} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded shadow-md uppercase text-[10px] transition-all">
                  {isSaving ? '...' : 'Annuler'}
                </button>
                <button onClick={saveToSheets} disabled={isSaving} className={`${saveStatus === 'success' ? 'bg-green-600' : 'bg-orange-600'} text-white font-bold py-2 px-3 rounded shadow uppercase text-[10px] transition-all`}>
                  {isSaving ? '...' : saveStatus === 'success' ? 'OK' : 'SAUVEGARDER'}
                </button>
              </>
            )}
            <button onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded shadow-md text-[10px] uppercase transition-all">PDF</button>
          </div>
        </div>
        <ReceiptPreview data={formData} />
      </div>
    </div>
  );
}

export default App;