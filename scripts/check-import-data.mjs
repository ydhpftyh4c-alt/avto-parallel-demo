import assert from 'node:assert/strict';
import {readImportModels} from './generate-import-catalog.mjs';
import {validateSupplierQuote} from './import-supplier-feed.mjs';
const models=await readImportModels();
const ids=new Set(models.map(m=>m.model_id));
assert.equal(ids.size,models.length);
for(const model of models){assert.equal(model.import_status,'requires_verification');assert.equal(model.estimate.low_rub,null);assert.equal(model.estimate.high_rub,null);}
const quote={provider_id:'test',external_id:'unit-only',model_id:models[0].model_id,market:'kr',currency:'KRW',price:1,source_url:'https://example.com/test',observed_at:'2026-10-19T00:00:00Z',year:null,engine_cc:null,power_kw:null,mileage_km:null};
assert.equal(validateSupplierQuote(quote,ids).estimate_status,'not_calculated');
for(const patch of [{provider_id:'../escape'},{price:-1},{model_id:'unknown'},{source_url:'http://example.com'},{market:'other'},{year:0},{power_kw:-1}])assert.throws(()=>validateSupplierQuote({...quote,...patch},ids));
console.log('Import data and supplier quote validation passed; no test quotes saved.');
