/**
 * OpenAPI 3.0 specification — served at /api/openapi.json, UI at /api/docs.
 */
export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'APIx — Real-Time Airfare Price Index API',
    version: '1.0.0',
    description:
      'Automated domestic airfare price index for MoSPI & RBI. Web-scraped, cleaned and normalized ' +
      'airline fares (IndiGo, Air India, Air India Express, Akasa Air, SpiceJet) across advance-booking ' +
      'windows T+1…T+45 for key DGCA-weighted city-pairs, aggregated into a chained Laspeyres index (base = 100).',
    contact: { name: 'NSO Statistical Data Collection', email: 'nso-demo@gov.in' },
    license: { name: 'MIT' },
  },
  servers: [{ url: '/', description: 'Current host' }],
  tags: [
    { name: 'index', description: 'Composite index snapshot & history' },
    { name: 'routes', description: 'City-pair catalog & sector aggregates' },
    { name: 'scraper', description: 'Collection engine control (protected)' },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' },
    },
  },
  paths: {
    '/api/v1/index/current': {
      get: {
        tags: ['index'],
        summary: 'Latest APIx score with sub-indices',
        responses: {
          200: {
            description: 'Current composite index, MoM/YoY deltas, per-route & per-window sub-indices',
            content: { 'application/json': { schema: { type: 'object' } } },
          },
        },
      },
    },
    '/api/v1/index/historical': {
      get: {
        tags: ['index'],
        summary: 'Historical index points for charts',
        parameters: [
          { name: 'timeframe', in: 'query', schema: { type: 'string', enum: ['7d', '30d', '90d', '180d', '1y'] }, example: '30d' },
          { name: 'route', in: 'query', schema: { type: 'string', example: 'DEL-BOM' }, description: 'Optional route filter (per-route sub-index series)' },
          { name: 'window', in: 'query', schema: { type: 'integer', enum: [1, 7, 15, 30, 45] }, description: 'Optional booking-window filter' },
        ],
        responses: { 200: { description: 'Series of { date, value, avgFare }' } },
      },
    },
    '/api/v1/routes': {
      get: {
        tags: ['routes'],
        summary: 'Tracked city-pairs with DGCA traffic weights',
        responses: { 200: { description: 'Route catalog' } },
      },
    },
    '/api/v1/routes/heatmap': {
      get: {
        tags: ['routes'],
        summary: 'Sector × booking-window surge matrix',
        responses: { 200: { description: 'Routes with per-window fare, baseline and % change plus 30-day sparklines' } },
      },
    },
    '/api/v1/routes/elasticity': {
      get: {
        tags: ['routes'],
        summary: 'Lead-time elasticity curves (avg fare per T+n)',
        responses: { 200: { description: 'Per-route fare curve across booking windows' } },
      },
    },
    '/api/v1/quotes': {
      get: {
        tags: ['routes'],
        summary: 'Raw Data Explorer — cleaned quote table (NSO export source)',
        parameters: [
          { name: 'route', in: 'query', schema: { type: 'string' } },
          { name: 'window', in: 'query', schema: { type: 'integer' } },
          { name: 'airline', in: 'query', schema: { type: 'string', example: '6E' } },
          { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Free-text match on route/carrier' },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 500, maximum: 5000 } },
          { name: 'skip', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: { 200: { description: 'Paged cleaned quotes with total count' } },
      },
    },
    '/api/v1/scraper/status': {
      get: {
        tags: ['scraper'],
        summary: 'Engine health, last sync and recent runs',
        responses: { 200: { description: 'Scraper status including audit log' } },
      },
    },
    '/api/v1/scraper/trigger': {
      post: {
        tags: ['scraper'],
        summary: 'Manually trigger a collection cycle (protected)',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  force: { type: 'boolean', description: 'Bypass the off-peak IST gate (demo only)' },
                  mode: { type: 'string', enum: ['simulate', 'live'] },
                  routes: { type: 'array', items: { type: 'string' }, example: ['DEL-BOM'] },
                  windows: { type: 'array', items: { type: 'integer' }, example: [1, 7] },
                },
              },
            },
          },
        },
        responses: {
          202: { description: 'Run completed' },
          401: { description: 'Missing/invalid x-api-key' },
          409: { description: 'Rejected by compliance gate (off-peak window)' },
        },
      },
    },
    '/api/v1/health': {
      get: { tags: ['scraper'], summary: 'Liveness probe', responses: { 200: { description: 'ok' } } },
    },
  },
};
