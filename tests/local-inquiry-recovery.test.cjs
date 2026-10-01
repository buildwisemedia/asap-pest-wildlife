const test = require('node:test');
const assert = require('node:assert/strict');
const {createLocalLedger} = require('../tools/local-inquiry-contract.cjs');
const input = extra => ({synthetic:true,client_slug:'asap-pest-wildlife',request_id:'synthetic-restart-1',
  source_page:'/rodent-removal/',identity_fixture:'synthetic-person-a',category:'homeowner_project',
  occurred_at:'2026-10-01T20:00:00Z',utm_source:'synthetic-newsletter',...extra});
const clone = value => JSON.parse(JSON.stringify(value));
function saved() {const ledger=createLocalLedger();ledger.accept(input());return clone(ledger.checkpoint());}

test('JSON checkpoint survives cold restart with source and pending mapping intact',()=>{
  const original=createLocalLedger();original.accept(input());original.attempt('synthetic-restart-1','timeout');
  const cold=createLocalLedger(clone(original.checkpoint()));
  assert.deepEqual(cold.snapshot(),original.snapshot());
  const retry=cold.accept(input());assert.equal(retry.created,false);assert.equal(cold.snapshot().length,1);
  assert.equal(retry.record.delivery_state,'mapping_pending');assert.equal(retry.record.provider_actions,0);
  const next=cold.accept(input({request_id:'synthetic-restart-2'}));assert.equal(next.created,true);
  assert.equal(next.record.identity_fixture,retry.record.identity_fixture);assert.equal(cold.snapshot().length,2);
});
test('all screening distinctions survive restore without promotion to qualified',()=>{
  for(const category of ['vendor','spam','test','homeowner_project','ambiguous','out_of_area']) {
    const ledger=createLocalLedger();ledger.accept(input({category}));
    const restored=createLocalLedger(clone(ledger.checkpoint())).snapshot()[0];
    assert.deepEqual(restored,ledger.snapshot()[0]);assert.equal(restored.qualification,'not_human_qualified');
  }
});
for(const [label,change] of [
  ['provider delivery',r=>r.delivery_state='delivered'],['qualified outcome',r=>r.qualification='qualified'],
  ['external item ID',r=>r.monday_item_id='invented'],['contact PII',r=>r.email='fixture@example.invalid'],
  ['tenant swap',r=>r.client_slug='another-client'],['homepage',r=>r.source_page='/'],
  ['mutable mapping',r=>r.monday_board_id='unverified'],['provider execution',r=>r.provider_actions=1],
  ['non-synthetic input',r=>r.synthetic=false],['invalid screening',r=>r.assessment='won']
]) test('restore rejects '+label,()=>{const data=saved();change(data.records[0]);assert.throws(()=>createLocalLedger(data));});
test('malformed, oversized, unknown-version and duplicate checkpoints fail closed',()=>{
  for(const data of [undefined,false,{}, {...saved(),schema:'asap-synthetic-ledger/2'},
    {...saved(),extra:'unexpected'}, {...saved(),records:null}, {...saved(),records:Array(1001).fill(saved().records[0])}]) {
    if(data===undefined) continue;
    assert.throws(()=>createLocalLedger(data));
  }
  const data=saved();data.records.push(clone(data.records[0]));
  assert.throws(()=>createLocalLedger(data),/duplicate_checkpoint_request/);
});
test('restore is isolated from caller mutation and has no transport capability',()=>{
  const data=saved();const restored=createLocalLedger(data);data.records[0].attribution.utm_source='changed';
  assert.equal(restored.snapshot()[0].attribution.utm_source,'synthetic-newsletter');
  assert.ok(Object.isFrozen(restored.snapshot()[0]));assert.ok(Object.isFrozen(restored.checkpoint().records));
  assert.equal('fetch' in restored,false);assert.equal(restored.attempt('synthetic-restart-1','offline').provider_actions,0);
});
test('fixture bound permits retries at capacity without making an unrestorable checkpoint',()=>{
  const ledger=createLocalLedger();
  for(let n=0;n<1000;n++) ledger.accept(input({request_id:'synthetic-bound-'+n}));
  assert.equal(ledger.accept(input({request_id:'synthetic-bound-0'})).created,false);
  assert.throws(()=>ledger.accept(input({request_id:'synthetic-bound-overflow'})),/synthetic_checkpoint_capacity_reached/);
  assert.equal(createLocalLedger(clone(ledger.checkpoint())).snapshot().length,1000);
});
