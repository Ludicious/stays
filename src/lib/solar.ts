// OWNER: set in_service_date to the actual date the solar system went live.
// solarSystemTotal() sums costs dynamically — edit costs here, not in components.
export const SOLAR_SYSTEM = {
  in_service_date: '2023-01-01',  // ← REPLACE with actual install date
  costs: {
    batteries:              5000,
    panels:                 3000,
    inverter:               3200,
    wiring_and_controllers: 1400,
  },
};

export function solarSystemTotal(): number {
  return Object.values(SOLAR_SYSTEM.costs).reduce((sum, v) => sum + v, 0);
}
