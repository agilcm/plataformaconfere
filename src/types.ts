export interface ServiceItem {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  shortDescription: string;
  fullDescription: string;
  image: string;
  imageAlt: string;
  features: string[];
  deliverables: string[];
  slas: string[];
  idealFor: string[];
}

export interface QuoteInputs {
  serviceId: string;
  areaSize: number; // in m²
  frequency: 'daily' | 'weekly_3x' | 'weekly_1x' | 'scale_12x36' | 'planton_24_7';
  staffCount: number;
  includesSupplies: boolean;
  dedicatedSupervisor: boolean;
  slaReporting: boolean;
  civilInsurance: boolean;
  clientName: string;
  companyName: string;
  clientEmail: string;
  clientPhone: string;
  additionalNotes: string;
}
