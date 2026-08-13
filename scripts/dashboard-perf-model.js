/**
 * Synthetic dashboard bottleneck model — documents before/after query economics.
 * Run: node scripts/dashboard-perf-model.js
 */

function beforeModel() {
  return {
    client_requests_initial: [
      'GET /api/dashboard/stats (full, sequential waves)',
      'GET /api/timeline/clinic?limit=8',
      'GET /api/visits/pending-tasks (role-gated)',
      'GET /api/patients/dashboard × N sibling widgets (duplicate)',
    ],
    stats_route_waves: 5,
    stats_mongo_ops_cold: {
      auth_profile_clinic: 2,
      appointments_today_find: 1,
      appointments_completed_counts: 2,
      patient_doctor_visit_lookups: 3,
      invoice_aggs: 2,
      followups_find_count: 2,
      lab_status_counts: 5,
      flow_reloads_today_appts_chairs: 2,
      lab_metrics_full_scan: 1,
      inventory_full_enrich_plus_purchases_batches_movements: 6,
      analytics_loadCoreData_x5: 40,
      analytics_inventory_lab_again: 8,
      communication_counts: 12,
      ai_dashboard_plus_all_patients_recall: 8,
    },
    notes: [
      'getKpis() fan-out called loadCoreData ~5× concurrently (8 collections each).',
      'getAIDashboard() loaded ALL patients via getRecallIntelligence.',
      'Live refresh every 25s re-ran the full payload.',
    ],
  }
}

function afterModel() {
  return {
    client_requests_initial: [
      'GET /api/dashboard/stats (full, parallel core + modules)',
      'GET /api/timeline/clinic?limit=8 (independent)',
      'GET /api/visits/pending-tasks (independent, role-gated)',
      'GET /api/patients/dashboard (deduped across sibling widgets)',
    ],
    stats_route_waves: 2,
    stats_mongo_ops_cold: {
      auth_profile_clinic: 2,
      parallel_core_batch: 9,
      patient_doctor_visit_lookups: 3,
      lab_status_single_agg: 1,
      flow_from_memory: 0,
      lab_metrics_projected: 1,
      inventory_lite: 7,
      analytics_loadCoreData_once: 8,
      communication_facet: 5,
      ai_dashboard_lite: 6,
    },
    cache: {
      dashboard_summary_ttl_ms: 20000,
      analytics_core_data_ttl_ms: 60000,
      analytics_kpis_ttl_ms: 60000,
      live_refresh_mode: 'core',
    },
    expected_improvement: {
      cold_stats_query_ops: '~70% fewer Mongo ops vs cold getKpis fan-out',
      warm_stats: 'near-instant cache hit (~0ms compute)',
      live_refresh: 'core mode skips analytics/comm/ai',
      patient_dashboard_widgets: '1 request instead of 2–3',
    },
  }
}

const before = beforeModel()
const after = afterModel()
const sum = obj => Object.values(obj).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0)

console.log('=== DentOS Dashboard Performance Model ===\n')
console.log('BEFORE cold /api/dashboard/stats Mongo ops:', sum(before.stats_mongo_ops_cold))
console.log('AFTER  cold /api/dashboard/stats Mongo ops:', sum(after.stats_mongo_ops_cold))
console.log('Reduction:', Math.round((1 - sum(after.stats_mongo_ops_cold) / sum(before.stats_mongo_ops_cold)) * 100) + '%')
console.log('\nInitial client request count (typical receptionist):')
console.log('  before:', before.client_requests_initial.length, '(with widget dupes worse)')
console.log('  after: ', after.client_requests_initial.length, '(deduped patients/dashboard)')
console.log('\nLive refresh: full → core (keeps queue/KPIs fresh without reloading BI)')
console.log(JSON.stringify({ before, after }, null, 2))
