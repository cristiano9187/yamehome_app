export interface PricingRule {
  prix: number;
  caution: number;
}

export interface ApartmentRate {
  address: string;
  units?: string[]; // AJOUT : Liste des identifiants calendrier (ex: matera-studio-a)
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

export interface Payment {
  id: string;
  date: string;
  amount: number;
  method: string;
}

export interface ReceiptData {
  receiptId: string;
  calendarSlug?: string; // AJOUT : L'unité spécifique choisie pour le calendrier
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  apartmentName: string;
  startDate: string;
  endDate: string;
  isCustomRate: boolean;
  customLodgingTotal: number;
  isNegotiatedRate: boolean;
  negotiatedPricePerNight: number;
  payments: Payment[];
  signature: string;
  hosts: string[];
  electricityCharge: boolean;
  packEco: boolean;
  observations: string;
}