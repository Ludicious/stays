// OWNER: update in_service_date if the system went live on a different date.
// total_cost is the all-in solar/electrical investment (itemization retired — see KNOWN_ISSUES.md).
// solarSystemTotal() returns total_cost directly — same signature, nothing else changes.
export const SOLAR_SYSTEM = {
  in_service_date: '2024-05-27',  // solar system wired up and live (owner-confirmed)
  total_cost:      12600,
};

export function solarSystemTotal(): number {
  return SOLAR_SYSTEM.total_cost;
}
