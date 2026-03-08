export interface PricingRule {
  prix: number;
  caution: number;
}

export interface ApartmentRate {
  address: string;
  '1-2'?: PricingRule;
  '3+'?: PricingRule;
  '1-6'?: PricingRule;
  '7-29'?: PricingRule;
  '30+'?: PricingRule;
  '7+'?: PricingRule;
}

export interface TarifMap {
  [key: string]: ApartmentRate;
}
// --- AJOUTE CELLE-CI (Nouvelle structure pour un versement) ---
export interface Payment {
  id: string;
  date: string;
  amount: number;
  method: string;
}
// --- MODIFIE CELLE-CI (Structure du reçu complet) ---
export interface ReceiptData {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  apartmentName: string;
  startDate: string;
  endDate: string;
  isCustomRate: boolean;
  customLodgingTotal: number;
  isNegotiatedRate?: boolean;
  negotiatedPricePerNight?: number;
  
  // ICI : On remplace paidAmount et paymentMethod par la liste
  payments: Payment[]; 

  signature: string;
  hosts: string[];
  electricityCharge: boolean;
  packEco: boolean;
  observations: string;
}