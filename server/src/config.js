/**
 * APIx — Domain configuration.
 * Single source of truth for airlines, city-pairs, booking windows and weights.
 */

export const AIRLINES = [
  { code: '6E', name: 'IndiGo', weight: 0.42 },
  { code: 'AI', name: 'Air India', weight: 0.14 },
  { code: 'IX', name: 'Air India Express', weight: 0.12 },
  { code: 'QP', name: 'Akasa Air', weight: 0.11 },
  { code: 'SG', name: 'SpiceJet', weight: 0.09 },
];

export const BOOKING_WINDOWS = [1, 7, 15, 30, 45]; // days ahead of departure (T+n)

/** DGCA passenger-traffic-weighted key city-pairs (origin, destination, share). */
export const ROUTES = [
  { id: 'DEL-BOM', origin: 'Delhi', originCode: 'DEL', destination: 'Mumbai', destinationCode: 'BOM', weight: 0.16, distanceKm: 1148 },
  { id: 'DEL-BLR', origin: 'Delhi', originCode: 'DEL', destination: 'Bengaluru', destinationCode: 'BLR', weight: 0.13, distanceKm: 1740 },
  { id: 'BOM-BLR', origin: 'Mumbai', originCode: 'BOM', destination: 'Bengaluru', destinationCode: 'BLR', weight: 0.11, distanceKm: 843 },
  { id: 'DEL-MAA', origin: 'Delhi', originCode: 'DEL', destination: 'Chennai', destinationCode: 'MAA', weight: 0.09, distanceKm: 1760 },
  { id: 'DEL-CCU', origin: 'Delhi', originCode: 'DEL', destination: 'Kolkata', destinationCode: 'CCU', weight: 0.09, distanceKm: 1300 },
  { id: 'BOM-MAA', origin: 'Mumbai', originCode: 'BOM', destination: 'Chennai', destinationCode: 'MAA', weight: 0.08, distanceKm: 1030 },
  { id: 'DEL-HYD', origin: 'Delhi', originCode: 'DEL', destination: 'Hyderabad', destinationCode: 'HYD', weight: 0.08, distanceKm: 1255 },
  { id: 'BOM-HYD', origin: 'Mumbai', originCode: 'BOM', destination: 'Hyderabad', destinationCode: 'HYD', weight: 0.07, distanceKm: 620 },
  { id: 'BLR-HYD', origin: 'Bengaluru', originCode: 'BLR', destination: 'Hyderabad', destinationCode: 'HYD', weight: 0.06, distanceKm: 454 },
  { id: 'DEL-PNQ', origin: 'Delhi', originCode: 'DEL', destination: 'Pune', destinationCode: 'PNQ', weight: 0.05, distanceKm: 1170 },
  { id: 'BOM-CCU', origin: 'Mumbai', originCode: 'BOM', destination: 'Kolkata', destinationCode: 'CCU', weight: 0.05, distanceKm: 1660 },
  { id: 'DEL-GOI', origin: 'Delhi', originCode: 'DEL', destination: 'Goa', destinationCode: 'GOI', weight: 0.03, distanceKm: 1510 },
];

export const ROUTE_IDS = ROUTES.map((r) => r.id);

/** City codes we can compose additional routes from when requested. */
export const CITY_CODES = [...new Set(ROUTES.flatMap((r) => [r.originCode, r.destinationCode]))];

/** Index methodology constants. */
export const INDEX_METHOD = {
  name: 'APIx',
  base: 100,
  formula: 'Chained Laspeyres price relative, base-period route/window weights',
  weightSource: 'DGCA domestic passenger traffic shares (FY 2023-24)',
};

export const TIMEFRAMES = ['7d', '30d', '90d', '180d', '1y'];
