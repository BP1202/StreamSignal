export interface ReportCreate {
  latitude: number;
  longitude: number;
  description: string;
  observed_at: string;
  water_appearance?: string | null;
  odor?: string | null;
  flow_condition?: string | null;
  foam_observed?: boolean;
  litter_observed?: boolean;
  dead_wildlife_observed?: boolean;
}

export interface ReportResponse extends ReportCreate {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ReportListResponse {
  items: ReportResponse[];
  limit: number;
  offset: number;
  total: number;
}

export interface SelectOption {
  label: string;
  value: string;
}

export const WATER_APPEARANCE_OPTIONS: SelectOption[] = [
  { label: "Clear / Transparent", value: "clear" },
  { label: "Cloudy / Murky", value: "cloudy" },
  { label: "Green surface material / Algae-like layer", value: "green_surface_material" },
  { label: "Oily film / Iridescent sheen", value: "oily_sheen" },
  { label: "Unnatural foam or suds", value: "foamy" },
  { label: "Unusually dark / Brown / Black", value: "dark_discolored" },
  { label: "Other visible appearance", value: "other" },
];

export const FLOW_CONDITION_OPTIONS: SelectOption[] = [
  { label: "Flowing normally", value: "flowing" },
  { label: "Slowly moving", value: "slow" },
  { label: "Stagnant / Standing water", value: "stagnant" },
  { label: "Completely dry stream bed", value: "dry" },
  { label: "Not sure", value: "not_sure" },
];

export const ODOR_OPTIONS: SelectOption[] = [
  { label: "No unusual smell noticed", value: "none_noticed" },
  { label: "Musty or earthy", value: "musty_earthy" },
  { label: "Sewage-like or sulfur/rotten egg", value: "sewage" },
  { label: "Chemical or petroleum-like", value: "chemical" },
  { label: "Other unusual smell", value: "other" },
  { label: "Not sure", value: "not_sure" },
];
