'use strict';
const fs = require('node:fs');
const {createLocalLedger} = require('./local-inquiry-contract.cjs');
// Synthetic input file only; this runner has no network or provider transport.
const input = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (input.mode !== 'local_only_no_network' || input.real_contact_data !== false) throw new Error('fixture_file_required');
const ledger = createLocalLedger();
const results = input.fixtures.map(({case: label, input: payload}) => {
  try {
    const accepted = ledger.accept(payload);
    const outcome = payload.simulate ? ledger.attempt(payload.request_id, payload.simulate) : accepted;
    return {case:label,state:outcome.state,created:accepted.created,record:outcome.record,provider_actions:0};
  } catch(error) {return {case:label,state:'rejected',reason:error.message,provider_actions:0};}
});
process.stdout.write(JSON.stringify({mode:'local_only_no_network',results,unique_inquiries:ledger.snapshot().length,provider_actions:0},null,2)+'\n');
