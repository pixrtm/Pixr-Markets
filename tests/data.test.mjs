import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizePoints,metrics,parseCSV,assets,assetFromListing} from '../src/data.js';
test('Return and maximum drawdown reflect a recovery after a 25% loss',()=>{
 const series=normalizePoints([{time:'2025-01-01',value:100},{time:'2025-01-02',value:120},{time:'2025-01-03',value:90},{time:'2025-01-04',value:110}]);
 const m=metrics(series);assert.ok(Math.abs(m.performance-10)<1e-9);assert.equal(m.maxDrawdown,-25);assert.ok(m.volatility>0);assert.equal(m.count,4);
});
test('Constant prices have zero risk variation',()=>{const m=metrics(normalizePoints([{time:'2025-01-01',value:100},{time:'2025-01-02',value:100},{time:'2025-01-03',value:100}]));assert.equal(m.volatility,0);assert.equal(m.performance,0);assert.equal(m.maxDrawdown,0)});
test('Invalid prices and duplicate observations are normalized',()=>{const p=normalizePoints([{time:'2025-01-02',value:3},{time:'2025-01-01',value:1},{time:'2025-01-02',value:2},{time:'nonsense',value:3},{time:'2025-01-03',value:0}]);assert.equal(p.length,2);assert.deepEqual(p.map(x=>x.value),[1,2]);assert.equal(metrics([]),null)});
test('CSV parsing sorts observations and handles decimal commas',()=>{const p=parseCSV('Date;Close\n2025-01-03;12,5\n2025-01-01;10\n2025-01-02;11');assert.equal(p[0].value,10);assert.equal(p[2].value,12.5);assert.throws(()=>parseCSV('Day,Value\n2025-01-01,100'));assert.throws(()=>parseCSV('Date,Close\n2025-01-01,100\n2025-01-02,-1\n2025-01-03,50'))});
test('Periods with missing observations expose their gaps',()=>{const m=metrics(normalizePoints([{time:'2025-01-01',value:10},{time:'2025-01-10',value:12},{time:'2025-01-11',value:11}]));assert.equal(m.maxGapDays,9)});
test('Asset identifiers are unique, all quote APIs are explicitly defined',()=>{assert.equal(new Set(assets.map(a=>a.id)).size,assets.length);for(const a of assets){assert.ok(a.tv);if(a.kind==='crypto')assert.ok(a.product);if(a.kind==='fx')assert.ok(a.base&&a.quote);if(a.kind==='stock'||a.kind==='index')assert.ok(a.chart)}});

test('CSV rejects calendar dates that JavaScript would silently roll over',()=>{
 assert.throws(()=>parseCSV('Date,Close\n2025-02-28,100\n2025-02-30,101\n2025-03-03,102'));
});
test('A world listing becomes a quotable asset and a known symbol stays unique',()=>{
 const nike=assetFromListing({symbol:'nke',quoteType:'EQUITY',shortname:'Nike, Inc.',exchDisp:'NYSE'});
 assert.equal(nike.id,'Y:NKE');assert.equal(nike.chart,'NKE');assert.equal(nike.tv,'NKE');assert.equal(nike.kind,'stock');assert.equal(nike.searched,true);
 assert.equal(assetFromListing({symbol:'MC.PA',quoteType:'EQUITY',shortname:'LVMH'}).tv,'EURONEXT:MC');
 assert.equal(assetFromListing({symbol:'7203.T',quoteType:'EQUITY',shortname:'Toyota'}).tv,'TSE:7203');
 assert.equal(assetFromListing({symbol:'AAPL',quoteType:'EQUITY',shortname:'Apple'}).id,'AAPL');
 assert.equal(assetFromListing({symbol:'EURUSD=X',quoteType:'CURRENCY',shortname:'EUR/USD'}).id,'EURUSD');
 assert.equal(assetFromListing({symbol:'../x',quoteType:'EQUITY',shortname:'X'}),null);
 assert.equal(assetFromListing({symbol:'HARIBO',quoteType:'OPTION',shortname:'Haribo'}),null);
});
