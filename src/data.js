// Public providers only. No synthetic quotes or fallback price series.
export const assets = [
{id:'BTC',name:'Bitcoin',symbol:'BTC / USD',kind:'crypto',region:'Global',currency:'USD',product:'BTC-USD',tv:'COINBASE:BTCUSD',icon:'₿',description:'Bitcoin est un actif numérique. Son cours dépend notamment de la liquidité, de la demande et du contexte réglementaire.'},
{id:'ETH',name:'Ethereum',symbol:'ETH / USD',kind:'crypto',region:'Global',currency:'USD',product:'ETH-USD',tv:'COINBASE:ETHUSD',icon:'Ξ',description:'Ether est l’actif du réseau Ethereum. L’activité du réseau, la concurrence et les évolutions techniques peuvent influencer son prix.'},
{id:'SOL',name:'Solana',symbol:'SOL / USD',kind:'crypto',region:'Global',currency:'USD',product:'SOL-USD',tv:'COINBASE:SOLUSD',icon:'S',description:'Solana est un réseau de contrats intelligents. L’adoption, la fiabilité du réseau et la liquidité constituent des facteurs à examiner.'},
{id:'EURUSD',name:'Euro / Dollar',symbol:'EUR / USD',kind:'fx',region:'Global',currency:'USD',base:'EUR',quote:'USD',tv:'FX:EURUSD',icon:'€',description:'Cette paire indique la valeur d’un euro en dollars américains. Les taux affichés sont des références quotidiennes, pas des cours exécutables.'},
{id:'EURCHF',name:'Euro / Franc suisse',symbol:'EUR / CHF',kind:'fx',region:'Europe',currency:'CHF',base:'EUR',quote:'CHF',tv:'FX:EURCHF',icon:'€',description:'Cette paire exprime la valeur d’un euro en francs suisses. Les politiques monétaires et les flux de capitaux influencent son évolution.'},
{id:'GBPUSD',name:'Livre / Dollar',symbol:'GBP / USD',kind:'fx',region:'Europe',currency:'USD',base:'GBP',quote:'USD',tv:'FX:GBPUSD',icon:'£',description:'Cette paire exprime la valeur d’une livre sterling en dollars américains.'},
{id:'SPX',name:'S&P 500',symbol:'SPX',kind:'index',region:'Amériques',currency:'Points',chart:'^GSPC',tv:'FOREXCOM:SPXUSD',icon:'US',description:'Le S&P 500 est un indice de grandes entreprises américaines. La série chiffrée correspond aux clôtures publiées de l’indice. Un graphique TradingView de secours peut afficher un CFD distinct.'},
{id:'NDX',name:'Nasdaq 100',symbol:'NDX',kind:'index',region:'Amériques',currency:'Points',chart:'^NDX',tv:'FOREXCOM:NSXUSD',icon:'US',description:'Le Nasdaq 100 rassemble de grandes sociétés non financières du Nasdaq. La série chiffrée correspond aux clôtures publiées de l’indice.'},
{id:'CAC',name:'CAC 40',symbol:'CAC',kind:'index',region:'Europe',currency:'Points',chart:'^FCHI',tv:'INDEX:CAC40',icon:'FR',description:'Le CAC 40 suit de grandes entreprises cotées à Paris. L’exposition internationale et la concentration sectorielle comptent dans son analyse.'},
{id:'DAX',name:'DAX',symbol:'DAX',kind:'index',region:'Europe',currency:'Points',chart:'^GDAXI',tv:'XETR:DAX',icon:'DE',description:'Le DAX suit de grandes sociétés allemandes. Il est sensible à la conjoncture industrielle et aux échanges mondiaux.'},
{id:'SMI',name:'Swiss Market Index',symbol:'SMI',kind:'index',region:'Europe',currency:'Points',chart:'^SSMI',tv:'SIX:SMI',icon:'CH',description:'Le SMI regroupe de grandes sociétés suisses. Sa concentration sur certains grands groupes est un facteur de risque.'},
{id:'NKY',name:'Nikkei 225',symbol:'NI225',kind:'index',region:'Asie',currency:'Points',chart:'^N225',tv:'INDEX:NKY',icon:'JP',description:'Le Nikkei 225 est un indice japonais pondéré par les cours. Le yen et la composition de l’indice influencent son évolution.'},
{id:'HSI',name:'Hang Seng',symbol:'HSI',kind:'index',region:'Asie',currency:'Points',chart:'^HSI',tv:'HSI:HSI',icon:'HK',description:'Le Hang Seng suit des entreprises cotées à Hong Kong et reste sensible au contexte économique et réglementaire chinois.'},
{id:'AAPL',name:'Apple',symbol:'AAPL',kind:'stock',region:'Amériques',currency:'USD',chart:'AAPL',tv:'NASDAQ:AAPL',icon:'A',description:'Apple commercialise des appareils et des services. Les ventes, les marges, la concurrence et la valorisation sont des points à examiner.'},
{id:'MSFT',name:'Microsoft',symbol:'MSFT',kind:'stock',region:'Amériques',currency:'USD',chart:'MSFT',tv:'NASDAQ:MSFT',icon:'M',description:'Microsoft développe des logiciels, des services cloud et des outils d’IA. La croissance du cloud, les dépenses et la valorisation demandent une analyse.'},
{id:'NVDA',name:'NVIDIA',symbol:'NVDA',kind:'stock',region:'Amériques',currency:'USD',chart:'NVDA',tv:'NASDAQ:NVDA',icon:'N',description:'NVIDIA conçoit des semi-conducteurs. La demande en calcul, la concurrence et les restrictions commerciales sont des facteurs à surveiller.'},
{id:'AIR',name:'Airbus',symbol:'AIR',kind:'stock',region:'Europe',currency:'EUR',chart:'AIR.PA',tv:'EURONEXT:AIR',icon:'A',description:'Airbus fabrique des avions et des équipements aéronautiques. Les livraisons, les commandes et les capacités de production sont des éléments clés.'},
{id:'NESN',name:'Nestlé',symbol:'NESN',kind:'stock',region:'Europe',currency:'CHF',chart:'NESN.SW',tv:'SIX:NESN',icon:'N',description:'Nestlé commercialise des produits alimentaires. Les volumes, les prix, les coûts et le change influencent ses résultats.'}
];
export const kindLabel = {crypto:'Crypto',fx:'Devises',index:'Indices',stock:'Actions'};
const memo = new Map();
const pending = new Map();
const DAY = 86400000;
async function getJSON(url, ttl=60000) {
 const hit=memo.get(url); if(hit&&Date.now()-hit.at<ttl)return hit.data;
 if(pending.has(url))return pending.get(url);
 const request=(async()=>{
  let r;try{r=await fetch(url,{signal:AbortSignal.timeout(20000)})}catch{throw new Error('Connexion au fournisseur indisponible. Réessayez plus tard.');}
  if(!r.ok){
   let message=r.status===429?'La source limite les requêtes. Réessayez dans une minute.':`La source est momentanément indisponible (${r.status}).`;
   try{const body=await r.json(); if(body.error) message=body.error;}catch{}
   throw new Error(message);
  }
  const data=await r.json(); memo.set(url,{at:Date.now(),data});return data;
 })();pending.set(url,request);try{return await request}finally{pending.delete(url)}
}
function gateway(params, ttl=60000) {
 return getJSON(`marche.php?${new URLSearchParams(params)}`, ttl);
}
const valid = v => Number.isFinite(Number(v)) && Number(v)>0;
export function normalizePoints(points) {
 const byTime=new Map();for(const p of points){const t=new Date(p.time).getTime();if(Number.isFinite(t)&&valid(p.value))byTime.set(t,{time:t,value:Number(p.value)});}
 return [...byTime.values()].sort((a,b)=>a.time-b.time);
}
function yahooMeta(data) {
 const result=data?.chart?.result?.[0];
 if(!result?.meta || data?.chart?.error) throw new Error('Cours boursier indisponible pour le moment.');
 return result;
}
const knownFx = {'EURUSD=X':'EURUSD','EURCHF=X':'EURCHF','GBPUSD=X':'GBPUSD'};
const listingKind = {EQUITY:'stock',ETF:'stock',MUTUALFUND:'stock',INDEX:'index',CRYPTOCURRENCY:'crypto',CURRENCY:'fx'};
const tvIndex={'^GSPC':'SP:SPX','^SPX':'SP:SPX','^NDX':'NASDAQ:NDX','^DJI':'DJ:DJI','^FCHI':'INDEX:CAC40','^GDAXI':'XETR:DAX','^SSMI':'SIX:SMI','^N225':'INDEX:NKY','^HSI':'HSI:HSI','^FTSE':'TVC:UKX','^STOXX50E':'TVC:SX5E','^VIX':'TVC:VIX','^IXIC':'NASDAQ:IXIC','^RUT':'TVC:RUT'};
const tvExchange={PA:'EURONEXT',AS:'EURONEXT',BR:'EURONEXT',LS:'EURONEXT',IR:'EURONEXT',SW:'SIX',L:'LSE',DE:'XETR',F:'FWB',T:'TSE',HK:'HKEX',TO:'TSX',AX:'ASX',MI:'MIL',MC:'BME',ST:'OMXSTO',HE:'OMXHEX',CO:'OMXCOP',OL:'OSL',VI:'VIE',KS:'KRX',TW:'TWSE',SI:'SGX',NS:'NSE',BO:'BSE',SA:'BMFBOVESPA',MX:'BMV'};
export function tradingViewSymbol(asset){
 if(!asset)return '';
 if(asset.tv)return asset.tv;
 const raw=String(asset.chart||'').toUpperCase();
 if(!raw)return '';
 if(tvIndex[raw])return tvIndex[raw];
 if(raw.endsWith('=X')&&/^[A-Z]{6}=X$/.test(raw))return 'FX:'+raw.slice(0,6);
 if(asset.kind==='crypto'&&raw.endsWith('-USD'))return 'COINBASE:'+raw.replace('-','');
 if(raw.startsWith('^'))return '';
 const dot=raw.lastIndexOf('.');
 if(dot<1)return raw;
 const exchange=tvExchange[raw.slice(dot+1)];
 return exchange?exchange+':'+raw.slice(0,dot):raw;
}
export function assetFromListing(hit) {
 if(!hit || typeof hit.symbol!=='string') return null;
 const symbol=hit.symbol.toUpperCase();
 if(!/^[A-Z0-9^=.-]{1,32}$/.test(symbol) || symbol.includes('..') || /^[.-]/.test(symbol)) return null;
 const kind=listingKind[hit.quoteType];
 if(!kind) return null;
 const known=assets.find(a=>a.chart===symbol || a.product===symbol) || assets.find(a=>a.id===knownFx[symbol]);
 if(known) return known;
 const name=String(hit.shortname||hit.longname||symbol).replace(/\s+/g,' ').trim();
 const region=String(hit.exchDisp||hit.exchange||'Marché').replace(/\s+/g,' ').trim();
 const phrase={stock:['une action','suivie'],index:['un indice','suivi'],crypto:['un crypto-actif','suivi'],fx:['une devise','suivie']}[kind];
 const row={id:'Y:'+symbol,name,symbol,kind,region,currency:hit.currency||(kind==='index'?'Points':'—'),chart:symbol,quoteType:hit.quoteType,icon:(name.match(/[A-Za-z0-9]/)||[symbol[0]])[0].toUpperCase(),searched:true,description:`${name} (${symbol}), ${phrase[0]} ${phrase[1]} sur ${region}. Les cours viennent de Yahoo Finance et peuvent être différés selon la place.`};
 row.tv=tradingViewSymbol(row);
 return row;
}
export async function searchMarkets(query) {
 const data=await gateway({op:'search',q:query},120000);
 const quotes=Array.isArray(data?.quotes)?data.quotes:[];
 const seen=new Set(), out=[];
 for(const hit of quotes){const asset=assetFromListing(hit); if(!asset||seen.has(asset.id)) continue; seen.add(asset.id); out.push(asset);}
 return out;
}
export async function quote(asset) {
 if(asset.kind==='crypto' && asset.product){
  const product=await gateway({op:'coinbase-product',product:asset.product});
  const price=Number(product.price), change=Number(product.price_percentage_change_24h);
  if(!valid(price)||!Number.isFinite(change)) throw new Error('Cours incomplet reçu de Coinbase.');
  return {price,change,time:new Date().toISOString(),receivedAt:new Date().toISOString(),source:'Coinbase',frequency:'Dernier cours · variation 24 h',sourceUrl:`https://www.coinbase.com/price/${asset.id==='BTC'?'bitcoin':asset.id==='ETH'?'ethereum':'solana'}`};
 }
 if(asset.kind==='fx' && asset.base && asset.quote){
  const start=new Date(Date.now()-10*DAY).toISOString().slice(0,10);
  const data=await getJSON(`https://api.frankfurter.dev/v2/rates?base=${asset.base}&quotes=${asset.quote}&from=${start}`,900000);
  if(!Array.isArray(data))throw new Error('Réponse de change invalide.');
  const pts=normalizePoints(data.filter(p=>p.base===asset.base&&p.quote===asset.quote).map(p=>({time:p.date,value:p.rate})));
  if(!pts.length)throw new Error('Aucun taux publié pour cette paire.');const last=pts.at(-1),prev=pts.at(-2);
  return {price:last.value,change:prev?(last.value/prev.value-1)*100:null,time:new Date(last.time).toISOString(),receivedAt:new Date().toISOString(),source:'Frankfurter',frequency:'Référence quotidienne · variation depuis la précédente',sourceUrl:'https://frankfurter.dev/'};
 }
 if(asset.chart){
  const result=yahooMeta(await gateway({op:'yahoo',symbol:asset.chart,range:'5d'}));
  const meta=result.meta, price=Number(meta.regularMarketPrice);
  if(meta.currency && (!asset.currency || asset.currency==='—')) asset.currency=meta.currency;
  if(!valid(price)) throw new Error('Cours boursier incomplet.');
  let change=Number(meta.regularMarketChangePercent);
  if(!Number.isFinite(change)&&valid(meta.chartPreviousClose)) change=(price/Number(meta.chartPreviousClose)-1)*100;
  const time=Number(meta.regularMarketTime);
  return {price,change:Number.isFinite(change)?change:null,time:Number.isFinite(time)?new Date(time*1000).toISOString():new Date().toISOString(),receivedAt:new Date().toISOString(),source:'Yahoo Finance',frequency:'Dernier cours publié · peut être différé',sourceUrl:`https://finance.yahoo.com/quote/${encodeURIComponent(asset.chart)}`};
 }
 return null;
}
export async function history(asset, period='1Y') {
 const days={ '1M':31,'6M':183,'1Y':366,'5Y':1826 }[period]||366;
 const end=Date.now(),start=end-days*DAY;
 let pts=[];
 if(asset.kind==='crypto' && asset.product){
  let cursor=Math.floor(end/1000);
  const oldest=Math.floor(start/1000);
  for(let i=0;i<8 && cursor>oldest;i++){
   const windowStart=Math.max(oldest, cursor-300*86400);
   if(cursor-windowStart<86400) break;
   const data=await gateway({op:'coinbase-candles',product:asset.product,start:String(windowStart),end:String(cursor)},900000);
   const candles=Array.isArray(data.candles)?data.candles:[];
   if(!candles.length) break;
   pts.push(...candles.map(c=>({time:Number(c.start)*1000,value:Number(c.close)})));
   cursor=windowStart-1;
  }
 } else if(asset.kind==='fx' && asset.base && asset.quote){
  const data=await getJSON(`https://api.frankfurter.dev/v2/rates?base=${asset.base}&quotes=${asset.quote}&from=${new Date(start).toISOString().slice(0,10)}&to=${new Date(end).toISOString().slice(0,10)}`,900000);
  if(!Array.isArray(data))throw new Error('Historique de change indisponible.');pts=data.filter(p=>p.base===asset.base&&p.quote===asset.quote).map(p=>({time:p.date,value:p.rate}));
 } else if(asset.chart){
  const range={'1M':'1mo','6M':'6mo','1Y':'1y','5Y':'5y'}[period]||'1y';
  const result=yahooMeta(await gateway({op:'yahoo',symbol:asset.chart,range},900000));
  const stamps=result.timestamp||[], closes=result.indicators?.quote?.[0]?.close||[];
  pts=stamps.map((t,i)=>({time:t*1000,value:closes[i]}));
 } else return [];
 return normalizePoints(pts).filter(p=>p.time>=start-DAY&&p.time<=end+DAY);
}
export function metrics(series) {
 if(series.length<2)return null;
 let peak=series[0].value,drawdown=0;const returns=[];const gaps=[];
 for(let i=0;i<series.length;i++){const v=series[i].value;peak=Math.max(peak,v);drawdown=Math.min(drawdown,v/peak-1);if(i){returns.push(Math.log(v/series[i-1].value));gaps.push((series[i].time-series[i-1].time)/DAY);}}
 const elapsedDays=(series.at(-1).time-series[0].time)/DAY;
 const avg=returns.reduce((a,b)=>a+b,0)/returns.length;
 const variance=returns.length>1?returns.reduce((a,b)=>a+(b-avg)**2,0)/(returns.length-1):null;
 const observationsPerYear=elapsedDays>0?returns.length/elapsedDays*365.25:null;
 return {performance:(series.at(-1).value/series[0].value-1)*100,maxDrawdown:drawdown*100,volatility:variance!==null&&observationsPerYear?Math.sqrt(variance*observationsPerYear)*100:null,low:Math.min(...series.map(p=>p.value)),high:Math.max(...series.map(p=>p.value)),count:series.length,start:new Date(series[0].time).toISOString().slice(0,10),end:new Date(series.at(-1).time).toISOString().slice(0,10),maxGapDays:Math.max(...gaps)};
}
export function parseCSV(text) {
 const lines=text.replace(/^\uFEFF/,'').trim().split(/\r?\n/);const delimiter=lines[0]?.includes(';')?';':',';
 const headers=lines[0]?.split(delimiter).map(x=>x.trim().replace(/^"|"$/g,'').toLowerCase())||[];
 const di=headers.findIndex(h=>['date','time','timestamp'].includes(h)),vi=headers.findIndex(h=>['close','cloture','clôture','price','value'].includes(h));
 if(di<0||vi<0)throw new Error('Le CSV doit contenir les colonnes Date et Close (prix de clôture).');
 const rows=lines.slice(1).filter(l=>l.trim()).map(l=>l.split(delimiter).map(x=>x.trim().replace(/^"|"$/g,'')));
 const points=rows.map(r=>({time:r[di],value:Number(r[vi]?.replace(',','.'))}));
 if(points.some(p=>!/^\d{4}-\d{2}-\d{2}$/.test(p.time)||!Number.isFinite(Date.parse(p.time))||new Date(p.time).toISOString().slice(0,10)!==p.time||!valid(p.value)))throw new Error('Dates attendues au format AAAA-MM-JJ et prix strictement positifs.');
 if(points.some(p=>Date.parse(p.time)>Date.now()))throw new Error('Le fichier contient des dates futures.');
 const series=normalizePoints(points);if(series.length<3)throw new Error('Au moins trois dates distinctes sont nécessaires.');if(series.length>20000)throw new Error('Maximum 20 000 lignes par fichier.');return series;
}
