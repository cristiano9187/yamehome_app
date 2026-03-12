import React, { useState, useEffect } from 'react';
import { TARIFS, PAYMENT_METHODS, HOSTS, getRateForApartment } from './constants';
import { ReceiptData } from './types';
import ReceiptPreview from './components/ReceiptPreview';

function App() {
  const generateNewId = () => `RC-${Math.floor(100000 + Math.random() * 900000)}`;

  const getInitialState = (): ReceiptData => ({
    receiptId: generateNewId(),
    calendarSlug: '',
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
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [searchId, setSearchId] = useState('');

  const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzfajRxCsKs0CLU4oiA6g5sirHUJHB3QdlJPeKOrjgFFDNQIeqbOxRlDqJ-VjAKZAuh2Q/exec';

  // --- EFFET : CHARGEMENT PAR LIEN MAGIQUE (?id=RC-xxxx) ---
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get('id');
    if (idFromUrl) {
      setSearchId(idFromUrl);
      setIsSaving(true);
      fetch(`${SCRIPT_URL}?id=${idFromUrl.trim().toUpperCase()}`)
        .then(res => res.json())
        .then(data => { if (!data.error) setFormData(data); })
        .finally(() => setIsSaving(false));
    }
  }, []);

  // --- EFFET : TITRE DYNAMIQUE ---
  useEffect(() => {
    const name = `${formData.firstName} ${formData.lastName}`.trim().replace(/\s+/g, '_');
    const apt = formData.apartmentName.split(' - ')[0].replace(/\s+/g, '_');
    const today = new Date();
    const dateStr = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getFullYear()}`;
    document.title = (name || apt) ? `Reçu_${name || 'Client'}_${apt || 'Apt'}_${dateStr}` : "YameHome - Reçus";
  }, [formData.firstName, formData.lastName, formData.apartmentName]);

  const resetForm = () => { if (window.confirm("Nouveau reçu ?")) setFormData(getInitialState()); };

  const saveToSheets = async () => {
    if (!formData.apartmentName || !formData.lastName) return alert("Remplir Nom et Appartement");
    setIsSaving(true);
    const diffTime = new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime();
    const nights = Math.max(0, Math.ceil(diffTime / (1000 * 3600 * 24)));
    const rates = getRateForApartment(formData.apartmentName, nights);
    const pricePerNight = formData.isNegotiatedRate ? (formData.negotiatedPricePerNight || 0) : rates.prix;
    const totalLodging = formData.isCustomRate ? formData.customLodgingTotal : (pricePerNight * nights);
    const grandTotal = totalLodging + rates.caution;
    const totalPaid = (formData.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);

    const payload = {
      receiptId: formData.receiptId,
      calendarSlug: formData.calendarSlug || TARIFS[formData.apartmentName]?.units?.[0] || '',
      firstName: formData.firstName,
      lastName: formData.lastName,
      apartmentName: formData.apartmentName,
      startDate: formData.startDate,
      endDate: formData.endDate,
      grandTotal, totalPaid, remaining: grandTotal - totalPaid,
      fullData: formData 
    };

    try {
      await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) { setSaveStatus('error'); } finally { setIsSaving(false); }
  };

  const loadReceipt = async () => {
    if (!searchId) return;
    setIsSaving(true);
    const formattedId = searchId.toUpperCase().startsWith('RC-') ? searchId.toUpperCase() : `RC-${searchId}`;
    try {
      const res = await fetch(`${SCRIPT_URL}?id=${formattedId}`);
      const data = await res.json();
      if (data.error) alert("Non trouvé"); else setFormData(data);
    } catch (e) { alert("Erreur"); } finally { setIsSaving(false); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    else if (name === 'hosts') {
      const selected = Array.from((e.target as HTMLSelectElement).selectedOptions).map(opt => opt.text);
      setFormData(prev => ({ ...prev, hosts: selected }));
    } else setFormData(prev => ({ ...prev, [name]: type === 'number' ? parseFloat(value) || 0 : value }));
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-900">
      <div className="w-full md:w-1/3 text-white p-6 overflow-y-auto h-auto md:h-screen print:hidden shadow-2xl">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-xl font-bold text-blue-400">YameHome</h1>
          <button onClick={resetForm} className="bg-red-500 text-white text-[9px] px-2 py-1 rounded font-bold uppercase transition-all">Nouveau</button>
        </div>

        <div className="bg-blue-900/20 p-4 rounded border border-blue-500/50 mb-6">
          <label className="text-blue-300 text-[10px] font-bold uppercase block mb-2">Charger un reçu</label>
          <div className="flex gap-2">
            <input type="text" placeholder="Ex: 815317" className="flex-1 bg-gray-800 rounded p-2 text-xs border border-blue-400/50" value={searchId} onChange={(e) => setSearchId(e.target.value)} />
            <button onClick={loadReceipt} className="bg-blue-600 text-white text-[10px] px-3 py-2 rounded font-bold">OK</button>
          </div>
        </div>

        <form className="space-y-4 text-sm" onSubmit={(e) => e.preventDefault()}>
          <div className="bg-gray-800 p-4 rounded border border-gray-700">
            <h3 className="text-gray-400 uppercase text-xs font-bold mb-3">Client</h3>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" name="firstName" value={formData.firstName} placeholder="Prénom" className="w-full bg-gray-700 rounded p-2 border border-gray-600" onChange={handleChange} />
              <input type="text" name="lastName" value={formData.lastName} placeholder="Nom" className="w-full bg-gray-700 rounded p-2 border border-gray-600" onChange={handleChange} />
            </div>
            <input type="tel" name="phone" value={formData.phone} placeholder="Tél" className="w-full mt-3 bg-gray-700 rounded p-2 border border-gray-600" onChange={handleChange} />
          </div>

          <div className="bg-gray-800 p-4 rounded border border-gray-700">
            <h3 className="text-gray-400 uppercase text-xs font-bold mb-3">Réservation</h3>
            <select name="apartmentName" value={formData.apartmentName} className="w-full bg-gray-700 rounded p-2 border border-gray-600 mb-3 text-xs" onChange={handleChange}>
              <option value="">-- Choisir Appartement --</option>
              {Object.keys(TARIFS).map(key => <option key={key} value={key}>{key}</option>)}
            </select>

            {/* AJOUT : CHOIX DE L'UNITÉ SPÉCIFIQUE */}
            {TARIFS[formData.apartmentName]?.units && (
              <div className="mb-3 p-2 bg-blue-900/10 border border-blue-500/30 rounded">
                <label className="text-[10px] text-blue-300 font-bold block mb-1">UNITÉ CALENDRIER</label>
                <select name="calendarSlug" value={formData.calendarSlug} onChange={handleChange} className="w-full bg-gray-700 text-xs p-1.5 rounded border border-blue-400">
                  <option value="">-- Préciser l'unité --</option>
                  {TARIFS[formData.apartmentName].units?.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mt-2">
              <input type="date" name="startDate" value={formData.startDate} className="w-full bg-gray-700 rounded p-2 border border-gray-600 text-xs" onChange={handleChange} />
              <input type="date" name="endDate" value={formData.endDate} className="w-full bg-gray-700 rounded p-2 border border-gray-600 text-xs" onChange={handleChange} />
            </div>
          </div>

          {/* ... Versements, Signature, Note (Le reste du formulaire reste identique à ta version actuelle) ... */}
          <div className="bg-gray-800 p-4 rounded border border-gray-700">
            <h3 className="text-gray-400 uppercase text-xs font-bold mb-3">Versements</h3>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center text-[10px]"><input type="checkbox" name="isCustomRate" checked={formData.isCustomRate} onChange={handleChange} className="mr-1" /> Platef.</label>
              <label className="flex items-center text-[10px]"><input type="checkbox" name="isNegotiatedRate" checked={formData.isNegotiatedRate} onChange={handleChange} className="mr-1" /> Négocié</label>
            </div>
            {formData.isCustomRate && <input type="number" name="customLodgingTotal" value={formData.customLodgingTotal} className="w-full bg-gray-700 rounded p-2 border border-yellow-600 text-yellow-300 mb-3 text-xs" placeholder="Total séjour" onChange={handleChange} />}
            {formData.isNegotiatedRate && <input type="number" name="negotiatedPricePerNight" value={formData.negotiatedPricePerNight} className="w-full bg-gray-700 rounded p-2 border border-blue-500 text-blue-300 mb-3 text-xs" placeholder="Prix nuit" onChange={handleChange} />}
            <div className="mt-4 border-t border-gray-700 pt-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Detail</span>
                <button type="button" onClick={() => setFormData(prev => ({...prev, payments: [...prev.payments, { id: Date.now().toString(), date: new Date().toISOString().split('T')[0], amount: 0, method: 'Espèces' }]}))} className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px]">+ ADD</button>
              </div>
              {formData.payments.map((p) => (
                <div key={p.id} className="bg-gray-700/40 p-2 rounded mb-2 border border-gray-600 relative text-[10px]">
                   <input type="date" value={p.date} onChange={(e) => setFormData(prev => ({...prev, payments: prev.payments.map(x => x.id === p.id ? {...x, date: e.target.value} : x)}))} className="bg-gray-800 rounded p-1 mb-1 w-full" />
                   <div className="flex gap-2">
                    <input type="number" value={p.amount || ''} placeholder="Montant" onChange={(e) => setFormData(prev => ({...prev, payments: prev.payments.map(x => x.id === p.id ? {...x, amount: parseFloat(e.target.value) || 0} : x)}))} className="bg-gray-800 rounded p-1 flex-1 font-bold text-green-400" />
                    <select value={p.method} onChange={(e) => setFormData(prev => ({...prev, payments: prev.payments.map(x => x.id === p.id ? {...x, method: e.target.value} : x)}))} className="bg-gray-800 rounded p-1 flex-1">
                      {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                   </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-gray-800 p-4 rounded border border-gray-700">
            <h3 className="text-gray-400 uppercase text-xs font-bold mb-3">Signature & Note</h3>
            <select name="hosts" multiple value={formData.hosts} onChange={handleChange} className="w-full bg-gray-700 rounded p-2 text-[10px] h-20 mb-3 border border-gray-600">
              {HOSTS.map(h => <option key={h.id} value={h.label}>{h.label}</option>)}
            </select>
            <input type="text" name="signature" value={formData.signature} placeholder="Signature" className="w-full bg-gray-700 rounded p-2 border border-gray-600 mb-3 text-xs" onChange={handleChange} />
            <textarea name="observations" value={formData.observations} rows={2} placeholder="Observations..." className="w-full bg-gray-700 rounded p-2 border border-gray-600 text-xs" onChange={handleChange}></textarea>
          </div>
        </form>
      </div>

      <div className="w-full md:w-2/3 bg-gray-200 p-2 md:p-8 flex flex-col items-start md:items-center overflow-y-auto h-auto md:h-screen preview-container">
        <div className="mb-4 no-print flex w-full max-w-[210mm] justify-between items-center print:hidden px-2">
          <div className="flex flex-col"><h2 className="text-gray-600 font-bold text-sm">Aperçu Reçu</h2><span className="text-[10px] text-gray-400 font-mono uppercase">{formData.receiptId}</span></div>
          <div className="flex gap-2">
            <button onClick={saveToSheets} disabled={isSaving} className={`${saveStatus === 'success' ? 'bg-green-600' : 'bg-orange-500'} text-white font-bold py-2 px-3 rounded text-[10px] shadow`}>{isSaving ? '...' : 'SAUVER'}</button>
            <button onClick={() => window.print()} className="bg-blue-600 text-white font-bold py-2 px-3 rounded text-[10px]">IMPRIMER</button>
          </div>
        </div>
        <ReceiptPreview data={formData} />
      </div>
    </div>
  );
}

export default App;