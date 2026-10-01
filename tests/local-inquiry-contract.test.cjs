const test = require('node:test');
const assert = require('node:assert/strict');
const {inquiry, createLocalLedger} = require('../tools/local-inquiry-contract.cjs');
const fixture = (extra = {}) => ({synthetic:true,client_slug:'asap-pest-wildlife',request_id:'synthetic-001',...extra});

test('known route and acquisition evidence round trip without inferred qualification', () => {
  const record=inquiry(fixture({source_page:'/wildlife-removal-canton/',city:'Canton',service_intent:'squirrel',
    category:'homeowner_project',occurred_at:'2026-10-01T12:00:00Z',utm_source:'fixture',referrer:'https://example.invalid/'}));
  assert.equal(record.source_page,'/wildlife-removal-canton/');assert.equal(record.city,'Canton');
  assert.equal(record.service_intent,'squirrel');assert.equal(record.attribution.utm_source,'fixture');
  assert.equal(record.occurred_at,'2026-10-01T12:00:00Z');assert.equal(record.assessment,'candidate_unqualified');
  assert.equal(record.qualification,'not_human_qualified');assert.equal(record.attribution.utm_medium,null);
});
test('unknown source and cookie do not become paid attribution or zero cost', () => {
  const record=inquiry(fixture({cookie:'meta-looking',source_page:null}));
  assert.equal(record.source_status,'source_unknown');assert.ok(Object.values(record.attribution).every(x=>x===null));
  assert.equal('cost' in record,false);assert.equal('cookie' in record,false);
});
for(const category of ['vendor','spam','test']) test(category+' remains screened out, never a sales-qualified opportunity',()=>{
  const record=inquiry(fixture({category,qualification:'qualified',won:true}));
  assert.equal(record.assessment,'screened_out_'+category);assert.equal(record.qualification,'not_human_qualified');
  assert.equal('won' in record,false);
});
test('same request retry is idempotent while a new episode preserves identity linkage',()=>{
  const ledger=createLocalLedger();const first=ledger.accept(fixture({identity_fixture:'identity-a'}));
  const retry=ledger.accept(fixture({identity_fixture:'identity-a',utm_source:'cannot-replace'}));
  const next=ledger.accept(fixture({request_id:'synthetic-002',identity_fixture:'identity-a'}));
  assert.equal(first.created,true);assert.equal(retry.created,false);assert.equal(retry.record,first.record);
  assert.equal(next.created,true);assert.equal(next.record.identity_fixture,first.record.identity_fixture);
  assert.equal(ledger.snapshot().length,2);
});
test('missing or supplied unverified Monday configuration cannot imply delivery',()=>{
  for(const config of [{},{monday_board_id:'unverified',monday_columns:{owner:'guessed'}}]) {
    const record=inquiry(fixture(config));assert.equal(record.delivery_state,'mapping_pending');
    assert.equal(record.monday_board_id,null);assert.equal(record.monday_columns,null);assert.equal(record.provider_actions,0);
  }
});
test('tenant override fails before ledger insertion and cannot share idempotency scope',()=>{
  const ledger=createLocalLedger();for(const extra of [{client_slug:'other-client'},{caller_client_slug:'other-client'}]) {
    assert.throws(()=>ledger.accept(fixture(extra)),/tenant_mismatch/);
  }assert.equal(ledger.snapshot().length,0);
});
test('capacity, owner and next-step date stay unresolved until human evidence',()=>{
  const record=inquiry(fixture({capacity_slots:10,owner:'guessed',due_at:'2026-10-02',qualification:'qualified'}));
  assert.equal(record.capacity_status,'human_capacity_review');assert.equal(record.owner,null);assert.equal(record.due_at,null);
});
for(const simulation of ['timeout','read_denied','offline']) test(simulation+' retains inquiry and never creates a false delivery receipt',()=>{
  const ledger=createLocalLedger();ledger.accept(fixture({source_page:'/rodent-removal/'}));
  const result=ledger.attempt('synthetic-001',simulation);assert.equal(result.state,'recoverable_not_delivered');
  assert.equal(result.record.source_page,'/rodent-removal/');assert.equal(result.record.delivery_state,'mapping_pending');
  assert.equal(ledger.snapshot().length,1);assert.equal(result.provider_actions,0);
});
test('real inputs, empty request IDs and nonlocal source routes are rejected',()=>{
  for(const extra of [{synthetic:false},{request_id:''},{request_id:'real-1'},{source_page:'//evil.invalid/'},
    {source_page:'https://example.invalid/'},{source_page:'/rodent/?email=private'}]) assert.throws(()=>inquiry(fixture(extra)));
});
test('homepage is explicitly excluded from the inner-page contract',()=>{
  for(const source_page of ['/','/index.html']) assert.throws(()=>inquiry(fixture({source_page})),/homepage_client_owned/);
});
test('output is immutable and strips contact PII, unverified outcomes and external automation fields',()=>{
  const record=inquiry(fixture({email:'synthetic@example.invalid',phone:'000',first_name:'Synthetic',details:'private',
    monday_item_id:'pretend',make_run:'pretend',quoted:true}));
  for(const key of ['email','phone','first_name','details','monday_item_id','make_run','quoted']) assert.equal(key in record,false);
  assert.ok(Object.isFrozen(record));assert.ok(Object.isFrozen(record.attribution));
});
