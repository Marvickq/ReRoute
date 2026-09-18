import type { MaterialLot, RoutingResult, FacilityEligibility } from "@/types";
import { FACILITIES, evaluateFacility, haversineDistance } from "./facilities";

const PUNE_LAT = 18.52;
const PUNE_LNG = 73.85;

function scoreFacility(
  eligibility: FacilityEligibility,
  lot: MaterialLot
): number {
  const facility = FACILITIES.find((f) => f.facility_id === eligibility.facility_id);
  if (!facility) return 0;

  const dist = haversineDistance(PUNE_LAT, PUNE_LNG, facility.lat, facility.lng);
  const distScore = Math.max(0, 1 - dist / 500);
  const capacityScore = 1 - facility.capacity;
  const handlingScore = eligibility.handling_capable ? 1 : 0;

  return distScore * 0.4 + capacityScore * 0.3 + handlingScore * 0.3;
}

export function evaluateRouting(lot: MaterialLot): RoutingResult {
  const materialCategories = [
    ...new Set(lot.material_items.map((item) => item.category)),
  ];
  const requiresSpecialHandling = [
    ...new Set(
      lot.material_items
        .filter((item) => item.battery_present)
        .map(() => "lithium_battery")
    ),
  ];

  const blockingReasons: string[] = [];

  if (lot.safety_result?.blocked) {
    blockingReasons.push(...lot.safety_result.blocking_reasons);
  }

  const eligibleFacilities: FacilityEligibility[] = FACILITIES.map((facility) =>
    evaluateFacility(facility, materialCategories, requiresSpecialHandling)
  );

  const routingBlocked = blockingReasons.length > 0;
  let recommendedFacilityId: string | null = null;

  if (!routingBlocked) {
    const eligible = eligibleFacilities.filter((e) => e.eligible);
    if (eligible.length > 0) {
      let bestScore = -1;
      for (const e of eligible) {
        const score = scoreFacility(e, lot);
        if (score > bestScore) {
          bestScore = score;
          recommendedFacilityId = e.facility_id;
        }
      }
    }
  }

  return {
    lot_id: lot.lot_id,
    eligible_facilities: eligibleFacilities,
    recommended_facility_id: recommendedFacilityId,
    routing_blocked: routingBlocked,
    blocking_reasons: blockingReasons,
    evaluated_at: new Date().toISOString(),
  };
}
