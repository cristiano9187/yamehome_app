import React from 'react';
import { ReceiptData } from '../types';
import { TARIFS, getRateForApartment, formatCurrency, LOGO_BASE64 } from '../constants';

interface ReceiptPreviewProps {
  data: ReceiptData;
}

const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({ data }) => {
  const nights = (new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) / (1000 * 3600 * 24) || 0;
  const rates = getRateForApartment(data.apartmentName, nights);

  // --- LOGIQUE DE CALCUL ---
  const pricePerNight = data.isNegotiatedRate ? (data.negotiatedPricePerNight || 0) : rates.prix;
  const totalLodging = data.isCustomRate ? data.customLodgingTotal : (pricePerNight * nights);
  const grandTotal = totalLodging + rates.caution;
  
  const totalPaid = (data.payments || []).reduce((sum, p) => sum + (p.amount || 0), 0);
  const remaining = grandTotal - totalPaid;

  const standardPrice = rates.prix;
  const discountPercent = standardPrice > 0 ? Math.round(((standardPrice - pricePerNight) / standardPrice) * 100) : 0;

  const receiptNumber = `RC-${Math.floor(Math.random() * 10000000)}`;
  const emissionDate = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  if (!data.apartmentName) {
    return (
      <div className="bg-white w-[210mm] min-h-[297mm] shadow-lg flex items-center justify-center text-gray-400 italic">
        Veuillez remplir les détails de la réservation pour voir l'aperçu.
      </div>
    );
  }

  return (
    <div id="receipt-content" className="bg-white w-[210mm] min-h-[297mm] p-10 shadow-lg text-gray-800 font-sans relative">
      
      {/* Header */}
      <div className="text-center mb-6 border-b-2 border-blue-900 pb-4">
        <h1 className="text-2xl font-bold text-blue-900 uppercase">YAMEHOME : REÇU DE PAIEMENT</h1>
        <p className="text-sm text-gray-600 mt-1">Location d'appartements, chambres et studios meublés</p>
        <p className="text-xs text-gray-500">+237 656 751 310 | christian@yamehome.com | www.yamehome.com</p>
        <div className="flex justify-center gap-4 mt-2 text-xs font-semibold text-gray-700">
          <span>Date d'émission: {emissionDate}</span>
          <span>|</span>
          <span>N°: {receiptNumber}</span>
        </div>
      </div>

      {/* Colonnes Client & Réservation OPTIMISÉES */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Client Info */}
        <div className="border rounded-lg p-3 bg-gray-50 flex flex-col justify-center">
          <h3 className="text-blue-900 font-bold border-b mb-2 pb-1 text-[11px] uppercase">Client</h3>
          <div className="text-[11px] leading-tight space-y-0.5">
            <p><span className="font-bold">Nom:</span> {data.firstName} {data.lastName}</p>
            <p><span className="font-bold">Tél:</span> {data.phone || 'N/A'}</p>
            <p className="truncate"><span className="font-bold">Email:</span> {data.email || 'N/A'}</p>
          </div>
        </div>

        {/* Reservation Info */}
        <div className="border rounded-lg p-3 bg-gray-50 flex flex-col justify-center">
          <h3 className="text-blue-900 font-bold border-b mb-2 pb-1 text-[11px] uppercase">Réservation</h3>
          <div className="text-[11px] leading-tight space-y-0.5">
            <p className="truncate"><span className="font-bold">Logement:</span> {data.apartmentName}</p>
            <p className="truncate"><span className="font-bold">Lieu:</span> {rates.address}</p>
            <p>
              <span className="font-bold">Séjour:</span> {nights} nts ({new Date(data.startDate).toLocaleDateString('fr-FR')} - {new Date(data.endDate).toLocaleDateString('fr-FR')})
            </p>
          </div>
        </div>
      </div>

      {/* Financial Details */}
      <div className="mb-6">
        <h3 className="text-blue-900 font-bold mb-3 text-sm uppercase">Détails Financiers</h3>
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-t">
              <td className="py-2">Prix par nuit {data.isNegotiatedRate && <span className="text-blue-600 text-xs">(Tarif Négocié)</span>}</td>
              <td className="py-2 text-right font-semibold">{formatCurrency(pricePerNight)}</td>
            </tr>
            {discountPercent > 0 && (
              <tr className="text-green-700 italic text-xs">
                <td>Remise appliquée (-{discountPercent}%)</td>
                <td className="text-right">(vs Tarif Std: {formatCurrency(standardPrice)})</td>
              </tr>
            )}
            <tr className="border-t">
              <td className="py-2">Sous-total Séjour</td>
              <td className="py-2 text-right font-semibold">{formatCurrency(totalLodging)}</td>
            </tr>
            <tr className="border-b border-gray-100">
              <td className="py-2">Caution (Remboursable)</td>
              <td className="py-2 text-right font-semibold">{formatCurrency(rates.caution)}</td>
            </tr>
            <tr className="bg-blue-50 font-bold">
              <td className="py-2 pl-2">Montant Total à Payer</td>
              <td className="py-2 pr-2 text-right text-base">{formatCurrency(grandTotal)}</td>
            </tr>

            {/* SECTION VERSEMENTS FILTRÉE */}
            {(data.payments || []).filter(p => (p.amount || 0) > 0).map((payment) => (
              <tr key={payment.id} className="text-green-700 text-xs border-b border-green-50">
                <td className="py-1.5 pl-2 italic">
                  Versement le {new Date(payment.date).toLocaleDateString()} ({payment.method})
                </td>
                <td className="py-1.5 pr-2 text-right font-bold italic">
                   + {formatCurrency(payment.amount || 0)}
                </td>
              </tr>
            ))}

            <tr className="bg-green-50 font-bold text-green-800 border-t-2 border-green-200">
              <td className="py-2 pl-2">TOTAL REÇU</td>
              <td className="py-2 pr-2 text-right text-base">{formatCurrency(totalPaid)}</td>
            </tr>

            <tr className="border-t-2 border-gray-300">
              <td className="py-2 pl-2 font-bold text-red-600 uppercase text-xs">Reste à Payer</td>
              <td className="py-2 pr-2 text-right font-bold text-red-600 text-lg">{formatCurrency(remaining)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Observations & Conditions */}
      <div className="border rounded-lg p-4 bg-gray-50 mb-8 text-xs">
        <h3 className="font-bold text-gray-700 mb-2">Observations & Conditions</h3>
        <ul className="list-disc pl-4 space-y-1 text-gray-600">
          <li>Check-in: 15h00 | Check-out: 11h30.</li>
          <li>Départ tardif: pénalité de {formatCurrency(12000)}.</li>
          {data.electricityCharge && <li><strong>Électricité à la charge du client.</strong></li>}
          {data.packEco && <li><strong>Pack ECO appliqué.</strong></li>}
          
          <li className="mt-2 text-[9px] leading-tight">
            <span className="font-bold underline">Politique d'Annulation (sur acompte) :</span>
            <ul className="list-disc ml-4 mt-1">
              <li><span className="font-semibold text-green-700">100% remboursé :</span> Annulation sous 24h (si séjour dans +14j).</li>
              <li><span className="font-semibold text-orange-600">50% remboursé :</span> Jusqu'à 7 jours avant l'arrivée.</li>
              <li><span className="font-semibold text-red-600">Non remboursable :</span> Moins de 7 jours avant l'arrivée.</li>
            </ul>
          </li>

          {data.observations && <li><em>Note: {data.observations}</em></li>}
        </ul>
        
        {data.hosts.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-200">
            <span className="font-semibold">Vos hôtes sur place : </span>
            {data.hosts.join(', ')}
          </div>
        )}
      </div>

      {/* Footer Signature */}
      <div className="mt-auto">
        <div className="flex justify-end mb-4 pr-4">
          <div className="text-center">
            <p className="text-blue-900 font-bold text-lg italic leading-none">{data.signature || 'PAOLA'}</p>
            <div className="border-t border-gray-400 mt-1 pt-1">
              <p className="text-[10px] font-bold uppercase text-gray-500">SIGNATURE GÉRANT / YAMEHOME</p>
            </div>
          </div>
        </div>
        <p className="text-center text-[10px] text-gray-400 italic mt-6">Merci pour votre confiance !</p>
      </div>

    </div>
  );
};

export default ReceiptPreview;