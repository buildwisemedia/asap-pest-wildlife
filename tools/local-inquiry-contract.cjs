'use strict';

// Review tooling only: never imported by a page or connected to a provider.
const TENANT = 'asap-pest-wildlife';
const {isDeepStrictEqual} = require('node:util');
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

function restoreRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error('invalid_checkpoint_record');
  const category = {
    screened_out_vendor: 'vendor', screened_out_spam: 'spam', screened_out_test: 'test',
    candidate_unqualified: 'homeowner_project'
  }[record.assessment];
  // Rebuild through the same tenant/synthetic boundary, then compare every field.
  // Extra contact data, provider IDs, qualification and delivered states fail closed.
  const rebuilt = inquiry({
    synthetic: record.synthetic, client_slug: record.client_slug, request_id: record.request_id,
    identity_fixture: record.identity_fixture, occurred_at: record.occurred_at,
    source_page: record.source_page, city: record.city, service_intent: record.service_intent,
    ...record.attribution, category
  });
  if (!isDeepStrictEqual(record, rebuilt)) throw new Error('invalid_checkpoint_record');
  return rebuilt;
}

function createLocalLedger(checkpoint = null) {
  const records = new Map();
  if (checkpoint !== null) {
    if (!checkpoint || checkpoint.schema !== 'asap-synthetic-ledger/1' || checkpoint.client_slug !== TENANT ||
      checkpoint.mode !== 'local_only_no_network' || checkpoint.provider_actions !== 0 ||
      !Array.isArray(checkpoint.records) || checkpoint.records.length > 1000 ||
      Object.keys(checkpoint).sort().join(',') !== 'client_slug,mode,provider_actions,records,schema') {
      throw new Error('invalid_checkpoint');
    }
    for (const stored of checkpoint.records) {
      const record = restoreRecord(stored);
      const key = record.client_slug + ':' + record.request_id;
      if (records.has(key)) throw new Error('duplicate_checkpoint_request');
      records.set(key, record);
    }
  }
  return Object.freeze({
    accept(input) {
      const record = inquiry(input);
      const key = record.client_slug + ':' + record.request_id;
      if (records.has(key)) return {state: 'duplicate_request', record: records.get(key), created: false};
      if (records.size >= 1000) throw new Error('synthetic_checkpoint_capacity_reached');
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
    snapshot() { return [...records.values()]; },
    checkpoint() {
      return Object.freeze({schema:'asap-synthetic-ledger/1', client_slug:TENANT,
        mode:'local_only_no_network', provider_actions:0, records:Object.freeze([...records.values()])});
    }
  });
}

module.exports = {inquiry, createLocalLedger};
