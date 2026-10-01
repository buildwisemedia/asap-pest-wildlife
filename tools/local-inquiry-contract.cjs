'use strict';

// Review tooling only: never imported by a page or connected to a provider.
const TENANT = 'asap-pest-wildlife';
const nullable = value => typeof value === 'string' && value.trim() ? value : null;

function inquiry(input) {
  if (!input || input.synthetic !== true) throw new Error('synthetic_only');
  if (input.client_slug !== TENANT || (input.caller_client_slug && input.caller_client_slug !== TENANT)) {
    throw new Error('tenant_mismatch');
  }
  const requestId = nullable(input.request_id);
  if (!requestId || !requestId.startsWith('synthetic-')) throw new Error('synthetic_request_required');
  const sourcePage = nullable(input.source_page);
  if (sourcePage === '/' || sourcePage === '/index.html') throw new Error('homepage_client_owned');
  if (sourcePage && (!sourcePage.startsWith('/') || sourcePage.startsWith('//') || /[?#]/.test(sourcePage))) {
    throw new Error('source_page_must_be_local_path');
  }
  let assessment = 'human_review_required';
  if (['vendor', 'spam', 'test'].includes(input.category)) assessment = 'screened_out_' + input.category;
  if (input.category === 'homeowner_project') assessment = 'candidate_unqualified';
  return Object.freeze({
    client_slug: TENANT, request_id: requestId,
    identity_fixture: nullable(input.identity_fixture),
    occurred_at: nullable(input.occurred_at),
    source_page: sourcePage, city: nullable(input.city), service_intent: nullable(input.service_intent),
    attribution: Object.freeze(Object.fromEntries(['utm_source', 'utm_medium', 'utm_campaign', 'referrer', 'gclid', 'fbclid']
      .map(key => [key, nullable(input[key])]))),
    source_status: sourcePage ? 'route_known_acquisition_unproven' : 'source_unknown',
    assessment, qualification: 'not_human_qualified',
    capacity_status: 'human_capacity_review', owner: null, next_step: 'review_mapping_and_assign_owner', due_at: null,
    monday_board_id: null, monday_columns: null, delivery_state: 'mapping_pending',
    synthetic: true, provider_actions: 0
  });
}

function createLocalLedger() {
  const records = new Map();
  return Object.freeze({
    accept(input) {
      const record = inquiry(input);
      const key = record.client_slug + ':' + record.request_id;
      if (records.has(key)) return {state: 'duplicate_request', record: records.get(key), created: false};
      records.set(key, record);
      return {state: 'mapping_pending', record, created: true};
    },
    attempt(requestId, simulation) {
      const key = TENANT + ':' + requestId;
      if (!records.has(key)) throw new Error('unknown_request');
      if (!['timeout', 'read_denied', 'offline'].includes(simulation)) throw new Error('failure_fixture_required');
      // No real transport. Failure is an observation; it cannot mark a record delivered.
      return {state: 'recoverable_not_delivered', reason: simulation, record: records.get(key), provider_actions: 0};
    },
    snapshot() { return [...records.values()]; }
  });
}

module.exports = {inquiry, createLocalLedger};
