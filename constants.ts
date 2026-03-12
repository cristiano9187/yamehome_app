import { TarifMap } from './types';

export const LOGO_BASE64 = "...";

export const TARIFS: TarifMap = {
  'RIETI YAMEHOME - APPARTEMENT TERRACOTTA mode STUDIO': { 
      address: 'Odza entrée Fécafoot Yaoundé, Porte 201',
      units: ['rieti-terracotta'],
      '1-6': { prix: 25000, caution: 10000 }, '7+': { prix: 23000, caution: 15000 }
  },
  'RIETI YAMEHOME - APPARTEMENT TERRACOTTA': { 
      address: 'Odza entrée Fécafoot Yaoundé, Porte 201',
      units: ['rieti-terracotta'],
      '1-6': { prix: 32000, caution: 10000 }, '7-29': { prix: 30000, caution: 15000 }, '30+': { prix: 26000, caution: 30000 }
  },
  'RIETI YAMEHOME - APPARTEMENT EMERAUDE mode STUDIO': { 
      address: 'Odza entrée Fécafoot Yaoundé, Porte 202',
      units: ['rieti-emeraude'],
      '1-6': { prix: 25000, caution: 10000 }, '7+': { prix: 23000, caution: 15000 }
  },
  'RIETI YAMEHOME - APPARTEMENT EMERAUDE': { 
      address: 'Odza entrée Fécafoot Yaoundé, Porte 202',
      units: ['rieti-emeraude'],
      '1-6': { prix: 32000, caution: 10000 }, '7-29': { prix: 30000, caution: 15000 }, '30+': { prix: 26000, caution: 30000 }
  },
  'MODENA YAMEHOME - APPARTEMENT HAUT STANDING mode STUDIO': { 
      address: 'Odza Brigade, Yaoundé',
      units: ['modena-haut-standing'],
      '1-6': { prix: 27000, caution: 10000 }, '7+': { prix: 24000, caution: 15000 }
  },
  'MODENA YAMEHOME - APPARTEMENT HAUT STANDING': { 
      address: 'Odza Brigade, Yaoundé',
      units: ['modena-haut-standing'],
      '1-6': { prix: 35000, caution: 10000 }, '7-29': { prix: 30000, caution: 15000 }, '30+': { prix: 27000, caution: 30000 }
  },
  'MATERA YAMEHOME - APPARTEMENT DELUXE mode STUDIO': { 
      address: 'Odza borne 10, Porte 201',
      units: ['matera-deluxe'],
      '1-6': { prix: 30000, caution: 10000 }, '7+': { prix: 25000, caution: 15000 }
  },
  'MATERA YAMEHOME - APPARTEMENT DELUXE': { 
      address: 'Odza borne 10, Porte 201',
      units: ['matera-deluxe'],
      '1-6': { prix: 40000, caution: 10000 }, '7-29': { prix: 34000, caution: 15000 }, '30+': { prix: 30000, caution: 30000 }
  },
  'MATERA YAMEHOME - STUDIO AMERICAIN': {
      address: 'Odza borne 10, Porte 103|203',
      units: ['matera-studio', 'matera-studio-superior'], 
      '1-6': { prix: 25000, caution: 5000 }, '7-29': { prix: 22500, caution: 10000 }, '30+': { prix: 20000, caution: 15000 }
  },
  'MATERA YAMEHOME - CHAMBRE STANDARD': {
      address: 'Odza borne 10, Porte 104 A|B',
      units: ['matera-chambre-a', 'matera-chambre-b'],
      '1-2': { prix: 15000, caution: 5000 }, '3+': { prix: 13000, caution: 10000 }
  },
  'GALLAGHERS CITY - CHAMBRE STANDARD SIMPLE': { 
      address: 'Lieu-dit Troisième Mi-temps. Bangangté',
      units: ['bgt-standard-a', 'bgt-standard-b', 'bgt-standard-c'],
      '1-6': { prix: 12000, caution: 5000 }, '7+': { prix: 10000, caution: 15000 }
  },
  'GALLAGHERS CITY - CHAMBRE STANDARD + CUISINE': { 
    address: 'Lieu-dit Troisième Mi-temps. Bangangté',
    units: ['bgt-cuisine'],
    '1-6': { prix: 15000, caution: 5000 }, '7+': { prix: 12000, caution: 15000 }
  }
};

export const PAYMENT_METHODS = ["Espèces", "Paiement mobile", "Virement bancaire", "PayPal", "Autre"];

export const HOSTS = [
  { id: "paola", label: "Paola (+237 691 47 24 82)" },
  { id: "edwige", label: "Edwige (+237 656 75 13 10)" },
  { id: "idriss", label: "Idriss (+237 651 16 37 50)" },
  { id: "pierre", label: "Pierre (+237 670 87 11 39)" },
  { id: "regine", label: "Regine (+237 692 79 22 26)" }
];

export const getRateForApartment = (apartmentName: string, nights: number): { prix: number; caution: number; address: string } => {
  const apartmentRules = TARIFS[apartmentName];
  if (!apartmentRules) return { prix: 0, caution: 0, address: 'Non trouvé' };
  const rateKeys = Object.keys(apartmentRules).filter(k => k !== 'address' && k !== 'units');
  let bestMatchKey: string | undefined;
  for (const key of rateKeys) {
    if (key.includes('+')) {
      const minNights = parseInt(key.replace('+', ''), 10);
      if (nights >= minNights) bestMatchKey = key;
    } else if (key.includes('-')) {
      const [min, max] = key.split('-').map(n => parseInt(n, 10));
      if (nights >= min && nights <= max) { bestMatchKey = key; break; }
    }
  }
  if (bestMatchKey) {
    const rate = apartmentRules[bestMatchKey as keyof typeof apartmentRules];
    if (typeof rate === 'object' && 'prix' in rate) {
      return { prix: rate.prix, caution: rate.caution, address: apartmentRules.address };
    }
  }
  return { prix: 0, caution: 0, address: apartmentRules.address };
};

export const formatCurrency = (amount: number) => {
  return amount.toLocaleString('fr-FR', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0, maximumFractionDigits: 0 });
};