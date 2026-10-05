export type JourneyStep =
  | "landing"
  | "capture"
  | "signals"
  | "location"
  | "submitting"
  | "interview"
  | "case"
  | "error";

export interface VisualSignalCard {
  id: string;
  emoji: string;
  title: string;
  description: string;
  fieldTrigger: "water_appearance" | "flow_condition" | "odor" | "foam" | "litter" | "wildlife" | "other";
}

export const VISUAL_SIGNALS: VisualSignalCard[] = [
  {
    id: "color",
    emoji: "🟢",
    title: "Unusual Color",
    description: "Green material, cloudy, or dark discoloration",
    fieldTrigger: "water_appearance",
  },
  {
    id: "foam",
    emoji: "🫧",
    title: "Foam or Suds",
    description: "Unnatural foam, froth, or detergent-like bubbles",
    fieldTrigger: "foam",
  },
  {
    id: "sheen",
    emoji: "✨",
    title: "Surface Sheen",
    description: "Oily film or rainbow-like surface sheen",
    fieldTrigger: "water_appearance",
  },
  {
    id: "litter",
    emoji: "🗑",
    title: "Visible Litter",
    description: "Trash, plastics, or discarded items in water",
    fieldTrigger: "litter",
  },
  {
    id: "wildlife",
    emoji: "🐟",
    title: "Wildlife Concern",
    description: "Dead fish, stressed aquatic life, or unusual animals",
    fieldTrigger: "wildlife",
  },
  {
    id: "flow",
    emoji: "🌊",
    title: "Flow Changed",
    description: "Completely stagnant, unusually slow, or dried up",
    fieldTrigger: "flow_condition",
  },
  {
    id: "odor",
    emoji: "👃",
    title: "Unusual Smell",
    description: "Musty, sewage-like, chemical, or sulfur odor",
    fieldTrigger: "odor",
  },
  {
    id: "other",
    emoji: "🔍",
    title: "Something Else",
    description: "Other visual change near the water body",
    fieldTrigger: "other",
  },
];
