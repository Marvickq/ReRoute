import type { Facility, FacilityEligibility } from "@/types";

export const FACILITIES: Facility[] = [
  {
    facility_id: "FAC-001",
    name: "GreenCycle Recyclers",
    location: "Pune, Maharashtra",
    lat: 18.52,
    lng: 73.85,
    accepted_materials: ["laptop", "desktop", "tablet", "monitor", "printer"],
    handling_capabilities: [],
    capacity: 0.45,
    available: true,
  },
  {
    facility_id: "FAC-002",
    name: "EcoTech Solutions",
    location: "Pune, Maharashtra",
    lat: 18.53,
    lng: 73.87,
    accepted_materials: ["laptop", "mobile_phone", "tablet", "battery", "charger"],
    handling_capabilities: ["lithium_battery"],
    capacity: 0.73,
    available: true,
  },
  {
    facility_id: "FAC-003",
    name: "SafeDisposal Pvt Ltd",
    location: "Mumbai, Maharashtra",
    lat: 19.07,
    lng: 72.87,
    accepted_materials: ["battery", "cable", "charger", "circuit_board"],
    handling_capabilities: ["lithium_battery", "hazardous_material"],
    capacity: 0.30,
    available: true,
  },
  {
    facility_id: "FAC-004",
    name: "TechReuse Foundation",
    location: "Nashik, Maharashtra",
    lat: 19.99,
    lng: 73.78,
    accepted_materials: ["laptop", "desktop", "mobile_phone", "tablet"],
    handling_capabilities: [],
    capacity: 0.90,
    available: true,
  },
  {
    facility_id: "FAC-005",
    name: "HazardWaste Solutions",
    location: "Nagpur, Maharashtra",
    lat: 21.14,
    lng: 79.08,
    accepted_materials: ["battery", "monitor", "crt_tv", "fluorescent_lamp"],
    handling_capabilities: ["lithium_battery", "hazardous_material", "lead_acid"],
    capacity: 0.55,
    available: false,
  },
];

const CAPACITY_THRESHOLD = 0.9;

export function evaluateFacility(
  facility: Facility,
  materialCategories: string[],
  requiresSpecialHandling: string[]
): FacilityEligibility {
  if (!facility.available) {
    return {
      facility_id: facility.facility_id,
      eligible: false,
      material_compatible: false,
      handling_capable: false,
      has_capacity: false,
      available: false,
      exclusion_reason: "Facility not currently operational",
    };
  }

  const normalizeCategory = (cat: string): string[] => {
    const raw = cat.toLowerCase().replace(/_/g, " ").trim();
    const categories: string[] = [raw];

    if (raw.includes("desktop") || raw.includes("computer") || raw.includes("pc")) categories.push("desktop", "laptop");
    if (raw.includes("laptop") || raw.includes("notebook")) categories.push("laptop");
    if (raw.includes("phone") || raw.includes("mobile") || raw.includes("smartphone")) categories.push("mobile_phone");
    if (raw.includes("tablet") || raw.includes("ipad")) categories.push("tablet");
    if (raw.includes("monitor") || raw.includes("display") || raw.includes("screen")) categories.push("monitor");
    if (raw.includes("printer") || raw.includes("scanner")) categories.push("printer");
    if (raw.includes("battery")) categories.push("battery", "lithium_battery");
    if (raw.includes("cable") || raw.includes("wire") || raw.includes("cord")) categories.push("cable");
    if (raw.includes("charger") || raw.includes("adapter")) categories.push("charger");
    if (raw.includes("circuit") || raw.includes("board") || raw.includes("pcb")) categories.push("circuit_board");
    if (raw.includes("tv") || raw.includes("television") || raw.includes("crt")) categories.push("crt_tv", "monitor");

    return categories;
  };

  const materialCompatible =
    materialCategories.length === 0 ||
    materialCategories.some((cat) => {
      const normalizedMatches = normalizeCategory(cat);
      return facility.accepted_materials.some((acc) =>
        normalizedMatches.some((norm) => norm === acc || norm.includes(acc) || acc.includes(norm))
      );
    });

  if (!materialCompatible) {
    return {
      facility_id: facility.facility_id,
      eligible: false,
      material_compatible: false,
      handling_capable: false,
      has_capacity: false,
      available: true,
      exclusion_reason: `Does not accept any of: ${materialCategories.join(", ")}`,
    };
  }

  const handlingCapable =
    requiresSpecialHandling.length === 0 ||
    requiresSpecialHandling.every((req) =>
      facility.handling_capabilities.includes(req)
    );

  if (!handlingCapable) {
    const missing = requiresSpecialHandling.filter(
      (req) => !facility.handling_capabilities.includes(req)
    );
    return {
      facility_id: facility.facility_id,
      eligible: false,
      material_compatible: true,
      handling_capable: false,
      has_capacity: false,
      available: true,
      exclusion_reason: `Missing capabilities: ${missing.join(", ")}`,
    };
  }

  const hasCapacity = facility.capacity < CAPACITY_THRESHOLD;

  if (!hasCapacity) {
    return {
      facility_id: facility.facility_id,
      eligible: false,
      material_compatible: true,
      handling_capable: true,
      has_capacity: false,
      available: true,
      exclusion_reason: `Capacity at ${Math.round(facility.capacity * 100)}% (threshold: ${Math.round(CAPACITY_THRESHOLD * 100)}%)`,
    };
  }

  return {
    facility_id: facility.facility_id,
    eligible: true,
    material_compatible: true,
    handling_capable: true,
    has_capacity: true,
    available: true,
    exclusion_reason: null,
  };
}

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
