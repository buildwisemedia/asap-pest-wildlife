const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'../assets/js/asap-close.js'),'utf8');

function setup({host='removeasap.com',state='production',integration='live',response={ok:true,capi_event_id:'server-event'},httpOk=true,reject=false,pending=false}={}) {
  const fields=Object.fromEntries(Object.entries({lead_id:'lead-1',source_page:'/wildlife-removal-canton/',first_name:'Preview',last_name:'Check',email:'preview@example.invalid',phone:'2025550100',issue:'Squirrel',details:'Synthetic form check',utm_source:'google',gclid:'test-click',_form_mount_at:'1000'}).map(([k,v])=>[k,{value:v}]));
  fields.sms_consent={checked:true,value:'on'};
  const events={}; const status={textContent:'',focus(){this.focused=true;}};const button={disabled:true};
  const form={dataset:{sourcePage:'/wildlife-removal-canton/',pageType:'city',service:'Pest and Wildlife Removal',city:'Canton',integrationState:integration},elements:{namedItem:n=>fields[n]},
    querySelector:s=>s==='[data-fixture-submit]'?button:status,addEventListener:(k,f)=>{events[k]=f;},checkValidity:()=>true,reportValidity(){},reset(){this.resetCalled=true;}};
  const calls=[];let resolve;
  const fetch=async(url,opts)=>{calls.push({url,body:JSON.parse(opts.body)});if(reject)throw Error('offline');if(pending)await new Promise(r=>resolve=r);return {ok:httpOk,json:async()=>response};};
  const window={location:{hostname:host,pathname:'/wildlife-removal-canton/',href:'https://'+host+'/wildlife-removal-canton/',search:''},crypto:{randomUUID:()=> 'next-id'},dispatchEvent(){}};
  const document={documentElement:{dataset:{buildState:state}},referrer:'https://www.google.com/',querySelectorAll:s=>s==='[data-asap-lead-form]'?[form]:[],querySelector:()=>null};
  vm.runInNewContext(source,{document,window,URL,URLSearchParams,fetch,FormData:class{constructor(){return Object.entries(fields).map(([k,v])=>[k,v.value]);}},AbortController,setTimeout,clearTimeout,CustomEvent:class{},console});
  return {form,fields,status,button,window,calls,submit:()=>events.submit?.({preventDefault(){}}),finish:()=>resolve()};
}
test('accepted lead includes page, service, city, inquiry and consent; conversion has no personal details',async()=>{
  const h=setup();assert.equal(h.button.disabled,false);await h.submit();assert.equal(h.calls.length,1);
  const p=h.calls[0].body;assert.equal(p.client_slug,'asap-pest-wildlife');assert.equal(p.formType,'contact');assert.equal(p.submission_page,'/wildlife-removal-canton/');assert.equal(p.source_page,p.submission_page);assert.equal(p.city,'Canton');assert.equal(p.message,'Synthetic form check');assert.equal(p.sms_consent,true);assert.equal(p.gclid,'test-click');assert.equal(p._form_mount_at,'1000');assert.equal(h.form.resetCalled,true);
  assert.match(h.status.textContent,/received/);const event=h.window.dataLayer[0];assert.equal(event.event_id,'server-event');for(const key of ['email','phone','first_name','details','message'])assert.equal(key in event,false);
});
for(const [name,opts] of [['network failure',{reject:true}],['HTTP error',{httpOk:false}],['filtered response',{response:{ok:true,filtered:true}}],['test response',{response:{ok:true,test_mode:true}}],['malformed success',{response:{}}]])test(name+' keeps details and allows retry',async()=>{
  const h=setup(opts);await h.submit();assert.match(h.status.textContent,/could not confirm/);assert.equal(h.form.resetCalled,undefined);assert.equal(h.button.disabled,false);assert.equal(h.window.dataLayer,undefined);
});
test('double submit starts one request and announces pending state',async()=>{
  const h=setup({pending:true});const one=h.submit();assert.equal(h.button.disabled,true);assert.match(h.status.textContent,/Sending/);await h.submit();assert.equal(h.calls.length,1);h.finish();await one;assert.equal(h.button.disabled,false);
});
test('preview fixtures never call the live endpoint',async()=>{
  const h=setup({host:'approval.asap-pest-wildlife.pages.dev',state:'local-review',integration:'fixture-only'});await h.submit();assert.equal(h.calls.length,0);assert.match(h.status.textContent,/No request was sent/);
});
test('live configuration on an unapproved host remains disabled',()=>{
  const h=setup({host:'preview.example'});assert.equal(h.button.disabled,true);assert.equal(h.submit(),undefined);assert.equal(h.calls.length,0);
});
test('page attribution survives cleared hidden fields and cannot be replaced by them',async()=>{
  const h=setup();h.fields.source_page.value='';await h.submit();assert.equal(h.calls[0].body.source_page,'/wildlife-removal-canton/');
});
