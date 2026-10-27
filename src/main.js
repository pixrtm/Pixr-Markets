import './style.css';
import {generate} from './ai.js';
import {assets,assetFromListing,kindLabel,quote,history,metrics,parseCSV,searchMarkets,tradingViewSymbol} from './data.js';
const $=id=>document.getElementById(id);
const state={asset:assets.find(a=>a.id==='EURUSD'),period:'1Y',kind:'all',page:'overview',q:null,series:[],stats:null,imported:new Map(),request:0,aiReady:true,aiBusy:false,turns:[],generation:0,remote:[],searching:false,searchError:'',searchToken:0};
function readIds(key){try{const v=JSON.parse(localStorage.getItem(key)||''); if(Array.isArray(v)) return v.filter(x=>typeof x==='string');}catch{} return null;}
let favorites=new Set(readIds('pixr-favorites')||['BTC','SPX','AAPL','EURCHF']);
const discovered=new Map();
function loadFound(key){try{const saved=JSON.parse(localStorage.getItem(key)||'[]'); if(Array.isArray(saved)) for(const hit of saved){const asset=assetFromListing(hit); if(asset?.searched) discovered.set(asset.id,asset);}}catch{}}
loadFound('pixr-found');
function findAsset(id){return assets.find(a=>a.id===id)||discovered.get(id)||state.remote.find(a=>a.id===id)}
function foundRows(){return [...discovered.values()].filter(a=>a.searched&&favorites.has(a.id)).map(a=>({symbol:a.chart,quoteType:a.quoteType,shortname:a.name,exchDisp:a.region,currency:a.currency}));}
function persistFound(){try{localStorage.setItem('pixr-found',JSON.stringify(foundRows()))}catch{}}
const quoteCache=new Map(),historyCache=new Map();
const format=(n,d=2)=>Number.isFinite(n)?new Intl.NumberFormat('fr-CH',{minimumFractionDigits:d,maximumFractionDigits:d}).format(n):'—';
const percent=n=>Number.isFinite(n)?`${n>0?'+':''}${format(n)} %`:'—';
const date=s=>new Date(s).toLocaleDateString('fr-CH',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const decimals=a=>a.kind==='fx'?4:2;
const sourceName=a=>a.kind==='crypto'&&a.product?'Coinbase':a.kind==='fx'&&a.base?'Frankfurter':'Yahoo Finance';
const changeLabel=a=>a.kind==='crypto'&&a.product?'sur 24 h':a.kind==='fx'&&a.base?'depuis la précédente référence':'depuis la clôture précédente';
const quoteDate=(q,a)=>a.kind==='fx'&&a.base?date(q.time):new Date(q.time).toLocaleString('fr-CH',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit'});
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,4500)}
function assetButton(a){return `<button class="asset-item ${a.id===state.asset.id?'selected':''}" data-select="${esc(a.id)}" aria-pressed="${a.id===state.asset.id}"><span class="asset-avatar">${esc(a.icon)}</span><span class="names"><strong>${esc(a.name)}</strong><small>${esc(a.symbol)} · ${esc(kindLabel[a.kind])}${a.searched?` · ${esc(a.region)}`:''}</small></span>${favorites.has(a.id)?'<span class="saved" aria-label="Dans votre sélection">·</span>':''}</button>`}
function list(){
 const needle=$('search').value.trim().toLowerCase();
 const match=a=>(state.kind==='all'||a.kind===state.kind)&&`${a.name} ${a.symbol} ${a.region}`.toLowerCase().includes(needle);
 const pinned=[...assets,...[...discovered.values()].filter(a=>a.searched&&favorites.has(a.id))];
 const local=pinned.filter(match);
 const remote=needle.length<2?[]:state.remote.filter(a=>match(a)&&!local.some(x=>x.id===a.id));
 const total=local.length+remote.length;
 $('asset-count').textContent=needle.length>=2?`${total} résultat${total===1?'':'s'}`:`${local.length} actif${local.length===1?'':'s'}`;
 $('favorites-count').textContent=favorites.size;
 let html='';
 if(local.length){if(needle.length>=2)html+=`<div class="list-label">Dans Pixr</div>`;html+=local.map(assetButton).join('');}
 if(needle.length>=2){
  html+=`<div class="list-label">Marchés mondiaux</div>`;
  if(state.searching&&!remote.length)html+=`<div class="empty">Recherche des cotations…</div>`;
  else if(state.searchError&&!remote.length)html+=`<div class="empty">${esc(state.searchError)}</div>`;
  else if(remote.length)html+=remote.map(assetButton).join('');
  else if(!local.length)html+=`<div class="empty">Aucune cotation publique pour « ${esc($('search').value.trim())} ». La recherche couvre les sociétés, fonds, indices, devises et cryptos réellement cotés. Une marque qui n’est pas en bourse, comme Haribo, n’a pas de cours.</div>`;
  else html+=`<div class="empty">Pas d’autre cotation pour cette recherche.</div>`;
 }
 if(!html)html='<div class="empty">Aucun actif dans cette sélection.</div>';
 $('asset-list').innerHTML=html;
}
async function searchWorld(){
 const q=$('search').value.trim(); const token=++state.searchToken;
 if(q.length<2){state.remote=[];state.searching=false;state.searchError='';list();return;}
 state.searching=true;state.searchError='';state.remote=[];list();
 try{const hits=await searchMarkets(q); if(token!==state.searchToken)return; state.remote=hits;}
 catch(e){if(token!==state.searchToken)return; state.remote=[]; state.searchError=e.message;}
 finally{if(token===state.searchToken){state.searching=false;list();}}
}
async function pulses(){
 const ids=['BTC','ETH','EURUSD','EURCHF'];
 $('pulse').innerHTML=ids.map(id=>{const a=assets.find(a=>a.id===id);return `<button class="pulse-card" data-select="${id}"><div class="pulse-top"><span>${a.name}</span><span class="pulse-symbol">${a.symbol}</span></div><div class="pulse-bottom"><span class="pulse-price" data-pulse-price="${id}">—</span><span class="pulse-change" data-pulse-change="${id}"></span></div><div class="pulse-date" data-pulse-date="${id}">Connexion à la source…</div></button>`}).join('');
 await Promise.allSettled(ids.map(async id=>{const a=assets.find(a=>a.id===id);try{const q=await quote(a);quoteCache.set(id,q);document.querySelector(`[data-pulse-price="${id}"]`).textContent=format(q.price,decimals(a));const change=document.querySelector(`[data-pulse-change="${id}"]`);change.textContent=percent(q.change);change.className='pulse-change '+(q.change==null?'muted':q.change>=0?'up':'down');document.querySelector(`[data-pulse-date="${id}"]`).textContent=`${a.kind==='fx'?'Référence quotidienne':'Variation 24 h'} · ${quoteDate(q,a)}`;}catch{document.querySelector(`[data-pulse-date="${id}"]`).textContent='Source indisponible · réessayer';}}));
}
function setFavorite(){const saved=favorites.has(state.asset.id);$('favorite').textContent=saved?'★':'☆';$('favorite').classList.toggle('saved',saved);$('favorite').setAttribute('aria-pressed',saved);$('favorite').setAttribute('aria-label',saved?'Retirer cet actif de ma sélection':'Ajouter cet actif à ma sélection')}
function resetMessages(){state.turns=[];$('messages').innerHTML=`<div class="welcome-message"><span class="message-label">PIXR ANALYST</span><p>L’analyse approfondie de <strong>${esc(state.asset.name)}</strong> se fait ici.</p><p class="muted">L’analyste reprend les chiffres déjà affichés dans le dossier, au même arrondi. Il n’en ajoute pas. Il peut malgré tout mal relier ces faits.</p></div>`;}
function interrupt(){state.generation++;state.aiBusy=false;$('analyst').classList.remove('is-thinking');$('send').hidden=false;$('stop-ai').hidden=true;}
function renderDossier(){
 const a=state.asset,q=state.q,m=state.stats;const cards=[];
 if(q)cards.push(`<div class="dossier-card"><span>Cours sourcé</span><strong>${format(q.price,decimals(a))} ${esc(a.currency)}</strong><p>${esc(percent(q.change))} ${esc(changeLabel(a))}. ${esc(q.source)}.</p></div>`);
 if(m){
  cards.push(`<div class="dossier-card"><span>Trajectoire</span><strong class="${m.performance>=0?'up':'down'}">${percent(m.performance)}</strong><p>Du ${esc(date(m.start))} au ${esc(date(m.end))}, ${m.count} clôtures.</p></div>`);
  cards.push(`<div class="dossier-card"><span>Amplitude</span><strong>${format(m.low,decimals(a))} – ${format(m.high,decimals(a))}</strong><p>Plus bas et plus haut des clôtures retenues.</p></div>`);
  cards.push(`<div class="dossier-card"><span>Risque passé</span><strong>${m.volatility==null?'—':format(m.volatility)+' %'}</strong><p>Volatilité annualisée. Plus forte baisse depuis un sommet : ${percent(m.maxDrawdown)}.${m.maxGapDays>4?' Des jours manquent dans la série.':''}</p></div>`);
 }
 $('ai-dossier').innerHTML=`<div class="dossier-kicker">Dossier calculé · ${esc(a.name)}</div>${cards.join('')||'<p class="dossier-note">Les mesures apparaîtront dès que la source aura répondu. L’analyste s’appuiera ensuite sur ces chiffres.</p>'}<p class="dossier-note">Ce dossier est calculé par Pixr. L’analyste s’y tient, et peut malgré tout mal relier ces faits.</p>`;
}
async function select(id,keepChat=false){
 if(state.aiBusy){interrupt();toast('La génération a été arrêtée lors du changement d’actif.');}
 const a=findAsset(id);if(!a)return;if(a.searched)discovered.set(a.id,a);state.asset=a;state.q=null;state.series=[];state.stats=null;const req=++state.request;
 $('detail-icon').textContent=a.icon;$('detail-name').textContent=a.name;$('detail-meta').textContent=`${a.symbol} · ${kindLabel[a.kind]} · ${a.region}`;$('ai-context').textContent=a.name;setFavorite();list();markSelection();if(!keepChat)resetMessages();
 document.querySelectorAll('[data-period]').forEach(b=>b.classList.toggle('selected',b.dataset.period===state.period));
 chartView=null;chartCursor=null;$('metrics').innerHTML='';$('reading').innerHTML='<p>Chargement des données de cet actif…</p>';$('line-chart').innerHTML='';$('tv-chart').replaceChildren();$('chart-note').textContent='';$('import-state').textContent='';renderDossier();
 const canImport=a.kind==='stock'||a.kind==='index';const imported=state.imported.get(a.id);const symbol=imported?'':tradingViewSymbol(a);$('import-open').hidden=!canImport;$('download-csv').hidden=true;
 $('detail-price').textContent='—';$('detail-price').className='price';$('detail-change').textContent='Connexion à la source…';$('detail-change').className='change muted';$('source-tag').textContent=imported?'CSV':sourceName(a);$('quote-time').textContent='';
 if(symbol){$('line-chart').hidden=true;$('tv-chart').hidden=false;$('chart-status').hidden=true;$('chart-label').textContent='Graphique interactif';openChartRoom();tvChart(symbol);}
 else{$('line-chart').hidden=false;$('tv-chart').hidden=true;$('chart-label').textContent='Série sourcée';$('chart-status').hidden=false;$('chart-status').className='chart-status';$('chart-status').textContent='Chargement de l’historique…';}
 if(imported){$('detail-price').textContent='CSV personnel';$('detail-change').textContent='Source non vérifiée';$('detail-change').className='change muted';}
 else quote(a).then(q=>{if(req!==state.request)return;state.q=q;quoteCache.set(a.id,q);renderQuote(q,a);renderDossier();}).catch(e=>{if(req===state.request){$('detail-change').textContent=e.message;$('detail-change').className='change down';}});
 try{
  let points;if(imported){const cutoff=Date.now()-({'1M':31,'6M':183,'1Y':366,'5Y':1826}[state.period])*86400000;points=imported.series.filter(p=>p.time>=cutoff);$('import-state').textContent='CSV personnel · '+imported.name;}else{const key=a.id+state.period;const cached=historyCache.get(key);points=cached&&Date.now()-cached.at<900000?cached.series:await history(a,state.period);historyCache.set(key,{at:Date.now(),series:points})}
  if(req!==state.request)return;if(points.length<3)throw new Error('Historique insuffisant sur cette période. Essayez une période plus longue.');state.series=points;state.stats=metrics(points);renderMetrics();reading();renderDossier();$('download-csv').hidden=false;
  const source=imported?'CSV personnel (source non vérifiée)':`${sourceName(a)} · ${a.kind==='fx'&&a.base?'taux de référence quotidiens':'clôtures quotidiennes, délai possible selon la place'}`;
  if(symbol){$('chart-note').textContent=narrowScreen.matches?`Pincer pour zoomer, glisser pour déplacer. Unités de temps et indicateurs dans la barre. Le dossier vient de ${sourceName(a)} · ${state.stats.count} clôtures.`:`Graphique TradingView : pincer ou molette pour zoomer, glisser pour se déplacer, bougies, indicateurs et tracés dans les barres. ${source} · ${state.stats.count} clôtures du ${date(points[0].time)} au ${date(points.at(-1).time)} alimentent le dossier, pas le graphique.`;}
  else{$('chart-status').hidden=true;drawChart();$('chart-note').textContent=`${source} · ${state.stats.count} observations · ${date(points[0].time)} – ${date(points.at(-1).time)}. Pincer, molette ou glisser pour zoomer. Double-clic pour tout revoir.`;}
 }catch(e){if(req!==state.request)return;state.series=[];state.stats=null;$('download-csv').hidden=true;if(symbol){$('chart-note').textContent='Graphique TradingView interactif. La série chiffrée du dossier n’est pas disponible : aucun chiffre n’est inventé pour l’analyste.';}else{$('chart-status').textContent=e.message;$('chart-status').className='chart-status error';$('chart-note').textContent='Aucune valeur estimée ou fictive n’est affichée.';}reading();renderDossier();}
}
function renderQuote(q,a){
 $('detail-price').innerHTML=`${format(q.price,decimals(a))}<span>${a.currency}</span>`;
 const direction=q.change==null?'muted':q.change>=0?'up':'down';
 $('detail-change').textContent=`${percent(q.change)} · ${changeLabel(a)}`;$('detail-change').className='change '+direction;$('source-tag').textContent=q.source;
 const age=Date.now()-Date.parse(q.time);$('quote-time').textContent=quoteDate(q,a)+(a.kind==='fx'&&age>4*86400000?' · référence ancienne':'');
 paintSelectionQuote(a,q);
}
let chartView=null,chartCursor=null;
function chartBounds(){const n=state.series.length;const i0=chartView?chartView.i0:0;const i1=chartView?chartView.i1:n-1;return {i0:Math.max(0,Math.min(i0,n-2)),i1:Math.max(Math.min(i1,n-1),Math.min(i0,n-2)+1),n};}
function zoomChart(factor,anchor){const {i0,i1,n}=chartBounds();const span=Math.max(2,i1-i0);const next=Math.max(8,Math.min(n-1,Math.round(span*factor)));const focus=i0+span*anchor;let a=Math.round(focus-next*anchor),b=a+next;if(a<0){b-=a;a=0;}if(b>n-1){a-=b-(n-1);b=n-1;}chartView={i0:Math.max(0,a),i1:Math.min(n-1,b)};drawChart();}
function panChart(dx,width){const {i0,i1,n}=chartBounds();const span=Math.max(2,i1-i0);const shift=Math.round(-dx/Math.max(width,1)*span);if(!shift)return;let a=i0+shift,b=i1+shift;if(a<0){b-=a;a=0;}if(b>n-1){a-=b-(n-1);b=n-1;}chartView={i0:Math.max(0,a),i1:Math.min(n-1,b)};drawChart();}
function drawChart(){
 const all=state.series;if(all.length<2||$('line-chart').hidden)return;const {i0,i1}=chartBounds();const pts=all.slice(i0,i1+1);const width=760,height=310,left=24,right=80,top=23,bottom=35;const css=getComputedStyle(document.documentElement);const gridColor=css.getPropertyValue('--chart-grid').trim()||'#e7ece6';const labelColor=css.getPropertyValue('--chart-label').trim()||'#8a978d';const upColor=css.getPropertyValue('--green').trim()||'#0a7862';const downColor=css.getPropertyValue('--red').trim()||'#b64748';let min=Math.min(...pts.map(p=>p.value)),max=Math.max(...pts.map(p=>p.value));const pad=(max-min)*.12||max*.01;min-=pad;max+=pad;
 const x=t=>left+(t-pts[0].time)/(pts.at(-1).time-pts[0].time||1)*(width-left-right),y=v=>top+(max-v)/(max-min||1)*(height-top-bottom);const step=Math.max(1,Math.floor(pts.length/450));const sampled=pts.filter((_,i)=>i%step===0||i===pts.length-1);const path=sampled.map((p,i)=>`${i?'L':'M'}${x(p.time).toFixed(2)},${y(p.value).toFixed(2)}`).join(' ');const color=(pts.at(-1).value>=pts[0].value)?upColor:downColor;
 const grid=Array.from({length:4},(_,i)=>{const v=min+(max-min)*i/3,yy=y(v);return `<line x1="${left}" x2="${width-right}" y1="${yy}" y2="${yy}" stroke="${gridColor}" stroke-dasharray="3 5"/><text x="${width-right+12}" y="${yy+4}" fill="${labelColor}" font-size="10" font-family="monospace">${format(v,state.asset.kind==='fx'?3:0)}</text>`}).join('');
 const ticks=Array.from({length:4},(_,i)=>{const t=pts[0].time+(pts.at(-1).time-pts[0].time)*i/3;return `<text x="${x(t)}" y="${height-9}" text-anchor="${i===0?'start':i===3?'end':'middle'}" fill="${labelColor}" font-size="10">${new Date(t).toLocaleDateString('fr-CH',{month:'short',year:state.period==='5Y'?'2-digit':undefined,day:state.period==='1M'?'2-digit':undefined,timeZone:'UTC'})}</text>`}).join('');
 let cross='';if(Number.isInteger(chartCursor)){const p=pts[Math.max(0,Math.min(pts.length-1,chartCursor))];const cx=x(p.time),cy=y(p.value);cross=`<line x1="${cx}" x2="${cx}" y1="${top}" y2="${height-bottom}" stroke="${labelColor}" stroke-dasharray="2 3"/><circle cx="${cx}" cy="${cy}" r="4" fill="${color}"/><text x="${Math.min(cx+8,width-right-120)}" y="${top+14}" fill="${labelColor}" font-size="11" font-family="monospace">${new Date(p.time).toLocaleDateString('fr-CH',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'})} · ${format(p.value,decimals(state.asset))}</text>`;}
 $('line-chart').innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Historique réel de ${state.asset.name}, ${state.stats.start} à ${state.stats.end}, performance ${format(state.stats.performance)} pour cent"><defs><linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1"><stop stop-color="${color}" stop-opacity=".12"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${grid}<path d="${path} L${width-right},${height-bottom} L${left},${height-bottom}Z" fill="url(#chart-fill)"/><path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${x(pts.at(-1).time)}" cy="${y(pts.at(-1).value)}" r="3.5" fill="${color}"/>${ticks}${cross}</svg>`;
}
function renderMetrics(){const m=state.stats;if(!m){$('metrics').innerHTML='';return;}$('metrics').innerHTML=`<div class="metric"><span>Performance sur la période</span><strong class="${m.performance>=0?'up':'down'}">${percent(m.performance)}</strong></div><div class="metric"><span>Volatilité annualisée</span><strong>${format(m.volatility)} %</strong></div><div class="metric"><span>Baisse maximale historique</span><strong>${percent(m.maxDrawdown)}</strong></div>`;}
function reading(){
 const a=state.asset,m=state.stats;if(!m){$('reading').innerHTML=`<p>${esc(a.description)}</p><div class="reading-cards"><div class="reading-card"><strong>Ce qui manque</strong><p>${$('tv-chart').hidden?'Les cours n’ont pas pu être chargés. Aucune valeur de remplacement n’est affichée.':'Le graphique TradingView est visible, mais ses cours ne sont pas transmis à l’analyste.'}</p></div><div class="reading-card"><strong>L’analyste</strong><p>Il peut expliquer l’actif en termes généraux, et il signalera que la série chiffrée est absente.</p></div></div>`;return;}
 $('reading').innerHTML=`<p>Entre le <strong>${date(m.start)}</strong> et le <strong>${date(m.end)}</strong>, la valeur a ${m.performance>=0?'progressé':'reculé'} de <strong>${format(Math.abs(m.performance))} %</strong>. Cette mesure porte sur les prix observés, hors frais, dividendes et fiscalité.</p><div class="reading-cards"><div class="reading-card"><strong>La trajectoire compte</strong><p>La plus forte baisse entre un sommet et un creux atteint ${format(Math.abs(m.maxDrawdown))} % sur cet historique. Le plus bas est ${format(m.low,decimals(a))} et le plus haut ${format(m.high,decimals(a))}.</p></div><div class="reading-card"><strong>Une mesure, pas une prévision</strong><p>${m.volatility!==null?'La volatilité annualisée de '+format(m.volatility)+' % décrit les fluctuations passées.':'Il manque des observations pour estimer la volatilité.'} ${m.maxGapDays>4?'L’historique présente des interruptions ; interpréter la volatilité avec prudence.':''} L’analyste développe cette lecture, sans la remplacer.</p></div></div>`;
}
function widget(container,scriptName,config,linkText,linkUrl){
 container.replaceChildren();const wrap=document.createElement('div');wrap.className='tradingview-widget-container';const body=document.createElement('div');body.className='tradingview-widget-container__widget';wrap.append(body);const credit=document.createElement('div');credit.className='tradingview-widget-copyright';const link=document.createElement('a');link.href=linkUrl;link.target='_blank';link.rel='noopener';link.textContent=linkText+' par TradingView';credit.append(link);wrap.append(credit);const script=document.createElement('script');script.src=`https://s3.tradingview.com/external-embedding/${scriptName}.js`;script.async=true;script.textContent=JSON.stringify(config);script.onerror=()=>{body.innerHTML='<div class="empty">Le graphique externe n’a pas pu se charger. Utilisez le lien TradingView ci-dessous.</div>';};wrap.append(script);container.append(wrap);
}
const scheme=matchMedia('(prefers-color-scheme: dark)');
const tvTheme=()=>scheme.matches?'dark':'light';
const narrowScreen=matchMedia('(max-width: 760px)');
function tvChart(symbol){const narrow=narrowScreen.matches;widget($('tv-chart'),'embed-widget-advanced-chart',{autosize:true,symbol,interval:'D',timezone:'Europe/Zurich',theme:tvTheme(),style:'1',locale:'fr',enable_publishing:false,allow_symbol_change:true,hide_top_toolbar:false,hide_side_toolbar:narrow,hide_legend:false,hide_volume:false,withdateranges:!narrow,details:!narrow,hotlist:false,calendar:false,save_image:!narrow,show_popup_button:!narrow,range:{'1M':'1M','6M':'6M','1Y':'12M','5Y':'60M'}[state.period]||'12M',support_host:'https://www.tradingview.com'},state.asset.name,`https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`)}
function world(){const dark=scheme.matches;$('world-widget').style.background=dark?'#131722':'';widget($('world-widget'),'embed-widget-market-quotes',{width:'100%',height:'100%',colorTheme:dark?'dark':'light',isTransparent:false,locale:'fr',showSymbolLogo:true,symbolsGroups:[{name:'États-Unis',symbols:[{name:'NASDAQ:AAPL',displayName:'Apple'},{name:'NASDAQ:MSFT',displayName:'Microsoft'},{name:'NASDAQ:NVDA',displayName:'NVIDIA'},{name:'NASDAQ:GOOGL',displayName:'Alphabet'}]},{name:'Europe',symbols:[{name:'EURONEXT:AIR',displayName:'Airbus'},{name:'SIX:NESN',displayName:'Nestlé'},{name:'XETR:SAP',displayName:'SAP'}]},{name:'Asie',symbols:[{name:'FX:USDJPY',displayName:'Dollar / Yen'},{name:'FX:AUDUSD',displayName:'Dollar australien / USD'}]}]},'Cours des marchés','https://www.tradingview.com/markets/stocks-worldwide/')}
function msg(text,type='assistant',label='PIXR ANALYST'){const el=document.createElement('div');el.className='message '+type;if(type==='assistant'){const title=document.createElement('span');title.className='message-label';title.textContent=label;el.append(title)}const body=document.createElement('div');body.className='body';body.textContent=text;el.append(body);$('messages').append(el);$('messages').scrollTop=$('messages').scrollHeight;return body;}
function context(){
 const a=state.asset,q=state.q,m=state.stats;
 const sample=state.series.slice(-8).map(p=>({date:new Date(p.time).toISOString().slice(0,10),cloture:Number(p.value.toFixed(decimals(a)))}));
 return {actif:a.name,symbole:a.symbol,devise:a.currency,decimales:decimals(a),description:a.description,source:state.imported.has(a.id)?'CSV personnel fourni par l’utilisateur, non vérifié':q?.source||(state.series.length?sourceName(a):'Aucun cours exploitable'),frequence:q?.frequency||'',cours:q?{prix:q.price,date:q.time,variation_pourcent:q.change}:null,historique:m?{performance_pourcent:m.performance,volatilite_annualisee_pourcent:m.volatility,baisse_maximale_pourcent:m.maxDrawdown,plus_bas:m.low,plus_haut:m.high,observations:m.count,debut:m.start,fin:m.end,ecart_max_jours:Math.round(m.maxGapDays)}:null,dernieres_clotures:sample,limites:'Pas de résultats d’entreprise ni d’actualités. Aucune prévision validée. Ne cite aucun chiffre absent de cet objet.'};
}
const pages={
 overview:{kicker:'LE MONDE DES MARCHÉS, À PORTÉE DE VUE',title:'Une lecture claire des marchés.',lead:'Des cours sourcés. Les fenêtres se tirent : explorateur, graphique, analyste.'},
 selection:{kicker:'VOS REPÈRES',title:'Ma sélection.',lead:'Uniquement les actifs marqués. Le graphique suit la carte ouverte.'},
 analyst:{kicker:'LECTURE ASSISTÉE',title:'L’analyste.',lead:'Il commente le dossier de l’actif choisi. Les chiffres du dossier font foi.'}
};
function showPage(page,scroll=true){
 if(!pages[page])page='overview';
 state.page=page;$('main').dataset.page=page;
 document.querySelectorAll('nav [data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
 $('page-kicker').textContent=pages[page].kicker;$('page-title').textContent=pages[page].title;$('page-lead').textContent=pages[page].lead;
 if(page==='selection')renderSelection();
 if(page==='analyst'){$('analyst').classList.remove('collapsed');persistFold();if(!$('disclaimer-dialog').open)$('question').focus({preventScroll:true});}
 try{sessionStorage.setItem('pixr-page',page)}catch{}
 if(scroll)window.scrollTo({top:0,behavior:'smooth'});
}
function paintSelectionQuote(a,q){
 const price=document.querySelector(`[data-sel-price="${CSS.escape(a.id)}"]`);
 const change=document.querySelector(`[data-sel-change="${CSS.escape(a.id)}"]`);
 if(!price||!change)return;
 price.textContent=`${format(q.price,decimals(a))} ${a.currency}`;
 change.textContent=`${percent(q.change)} · ${changeLabel(a)}`;
 change.className='selection-change '+(q.change==null?'muted':q.change>=0?'up':'down');
}
function markSelection(){document.querySelectorAll('.selection-card').forEach(card=>{const on=card.dataset.select===state.asset.id;card.classList.toggle('selected',on);card.setAttribute('aria-pressed',String(on));});}
let selectionToken=0;
async function renderSelection(){
 const token=++selectionToken;const ids=[...favorites];const root=$('selection-cards');
 if(!ids.length){root.innerHTML='<div class="empty">Aucun actif dans votre sélection. Sur la vue d’ensemble, ouvrez un cours et touchez l’étoile.</div>';return;}
 root.innerHTML=ids.map(id=>{const a=findAsset(id);if(!a)return '';const on=a.id===state.asset.id;return `<button class="selection-card${on?' selected':''}" data-select="${esc(a.id)}" aria-pressed="${on}"><span class="selection-kicker">${esc(kindLabel[a.kind])} · ${esc(a.symbol)}</span><strong>${esc(a.name)}</strong><span class="selection-price" data-sel-price="${esc(a.id)}">—</span><span class="selection-change muted" data-sel-change="${esc(a.id)}">Connexion…</span></button>`;}).join('')||'<div class="empty">Ces favoris ne sont plus disponibles.</div>';
 await Promise.allSettled(ids.map(async id=>{const a=findAsset(id);if(!a)return;try{const q=quoteCache.get(id)||await quote(a);if(token!==selectionToken)return;quoteCache.set(id,q);paintSelectionQuote(a,q);}catch(e){if(token!==selectionToken)return;const change=document.querySelector(`[data-sel-change="${CSS.escape(id)}"]`);if(change){change.textContent=e.message;change.className='selection-change down';}}}));
}
const panes={explorer:248,analyst:420,chart:640};
function openChartRoom(){if(panes.chart<560)panes.chart=640;applyPanes();}
try{const saved=JSON.parse(localStorage.getItem('pixr-panes')||'{}');for(const key of Object.keys(panes))if(Number.isFinite(saved[key]))panes[key]=saved[key];}catch{}
function wide(){return window.innerWidth>980}
function persistPanes(){try{localStorage.setItem('pixr-panes',JSON.stringify(panes))}catch{}}
function persistFold(){try{localStorage.setItem('pixr-folded',JSON.stringify({explorer:$('pane-explorer').classList.contains('collapsed'),analyst:$('analyst').classList.contains('collapsed')}))}catch{}}
function applyPanes(){
 const explorer=$('pane-explorer'),analyst=$('analyst'),chart=$('chart-area');
 if(!wide()){explorer.style.width='';explorer.style.flexBasis='';analyst.style.width='';analyst.style.flexBasis='';chart.style.height='';return;}
 explorer.style.flexBasis=panes.explorer+'px';explorer.style.width=panes.explorer+'px';
 analyst.style.flexBasis=panes.analyst+'px';analyst.style.width=panes.analyst+'px';
 chart.style.height=panes.chart+'px';
}
function bindSplitter(bar,key,sign,min,max){
 const horizontal=bar.dataset.split==='chart';
 bar.addEventListener('pointerdown',e=>{
  if(e.button!==0||!wide())return;e.preventDefault();
  const start={x:e.clientX,y:e.clientY,value:panes[key]};
  const move=ev=>{panes[key]=Math.round(Math.max(min,Math.min(max,start.value+((horizontal?ev.clientY-start.y:ev.clientX-start.x)*sign))));applyPanes();};
  bar.classList.add('dragging');document.body.classList.add('is-resizing');
  const up=()=>{bar.classList.remove('dragging');document.body.classList.remove('is-resizing');window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);persistPanes();};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
 });
 bar.addEventListener('dblclick',()=>{panes[key]=key==='explorer'?248:key==='analyst'?420:640;applyPanes();persistPanes();});
 bar.addEventListener('keydown',e=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();
  const step=e.shiftKey?48:16;const dir=(e.key==='ArrowRight'||e.key==='ArrowDown')?1:-1;
  panes[key]=Math.round(Math.max(min,Math.min(max,panes[key]+dir*sign*step)));applyPanes();persistPanes();
 });
}
function togglePane(name){const pane=name==='explorer'?$('pane-explorer'):$('analyst');pane.classList.toggle('collapsed');persistFold();}
try{const folded=JSON.parse(localStorage.getItem('pixr-folded')||'{}');if(folded.explorer)$('pane-explorer').classList.add('collapsed');if(folded.analyst)$('analyst').classList.add('collapsed');}catch{}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function reasonKind(question){
 const q=String(question||'').toLowerCase();
 if(/achet|vend|conseil|objectif|prix cible|probabilit/.test(q))return 'refuse';
 if(/risque/.test(q))return 'risks';
 if(/sc[eé]nario/.test(q))return 'scenarios';
 if(/ombre|manque|aveugle/.test(q))return 'blind';
 if(/r[eé]sum/.test(q))return 'summary';
 return 'analyse';
}
function reasoningParagraphs(question){
 const name=state.asset.name;
 const period={'1M':'le dernier mois affiché','6M':'les six mois affichés','1Y':'l’année affichée','5Y':'les cinq années affichées'}[state.period]||'la période affichée';
 const source=state.imported.has(state.asset.id)?'le fichier CSV personnel, dont la provenance n’est pas vérifiée':(state.q?.source||(state.series.length?sourceName(state.asset):'aucune source encore disponible'));
 const hole=state.stats
  ?`Pour ${period}, le dossier a déjà posé la performance, le plus bas, le plus haut, la volatilité et la baisse depuis un sommet. Je les reprends tels qu’ils sont affichés. Je ne les rallonge pas, et je ne les remplace pas par un autre calcul.`
  :`La série chiffrée de ${name} n’est pas au dossier. Je ne vais pas fabriquer un cours, une performance ou une volatilité pour remplir le vide.`;
 const guard='Avant d’écrire, je repasse chaque nombre. Il doit déjà être à l’écran, au même arrondi. S’il n’y est pas, la phrase est écartée. Aucun objectif, aucune probabilité, aucun conseil d’acheter ou de vendre.';
 const packs={
  blind:[
   `La question porte sur les zones d’ombre de ${name}. Je dois dire ce que le dossier ne permet pas de voir, pas ce que je pourrais imaginer à sa place.`,
   `Je repars de la source sous les yeux : ${source}. Je ne consulte pas un autre fournisseur, je ne cherche pas une actualité, et je ne suppose aucun résultat d’entreprise.`,
   hole,
   `Je sépare ensuite ce qui est mesuré de ce qui est absent. Les frais, les dividendes et la fiscalité ne sont pas dans la performance. Le carnet d’ordres n’y est pas. Le motif de chaque mouvement non plus. Un autre fournisseur pourrait afficher un cours différent : dans ce cas, les chiffres du dossier restent la référence.`,
   `Une zone d’ombre n’est pas une prévision déguisée. Constater un manque est fidèle au dossier. En déduire le prochain cours ne le serait pas. Je garde le manque, et j’écarte la suite inventée.`,
   guard
  ],
  risks:[
   `On me demande le risque de ${name}. Je limite cela à ce que la fenêtre passée a déjà montré, sans le transformer en perte future.`,
   `La source retenue est ${source}. Je ne mélange pas ce cours avec celui d’une autre place, et je n’ajoute pas un événement qui n’est pas dans le dossier.`,
   hole,
   `La volatilité décrit des à-coups déjà observés. La baisse depuis un sommet décrit le pire passage déjà vu dans la fenêtre. Ni l’une ni l’autre n’est un plafond, ni une garantie, ni une annonce de ce qui vient.`,
   state.stats&&state.stats.maxGapDays>4
    ?`La série a des interruptions. Je le garde en tête : une volatilité calculée sur des jours manquants se lit avec plus de prudence, sans que je comble ces jours par des prix absents.`
    :`Je vérifie aussi si la série est continue. Sans trou notable dans le dossier, je ne vais pas inventer une interruption.`,
   `Le risque que je peux écrire est donc un constat. Le risque que je ne peux pas écrire est tout ce qui dépendrait d’une nouvelle, d’un résultat ou d’un ordre qui n’est pas là.`,
   guard
  ],
  scenarios:[
   `La demande concerne des scénarios pour ${name}. Ils doivent rester conditionnels : si ceci, alors le dossier ne suffit plus à décrire cela. Pas de prix cible, pas de probabilité.`,
   `Je m’appuie sur ${source}, et seulement sur elle. Un scénario qui introduirait un cours absent serait une invention, pas une lecture.`,
   hole,
   `Un premier cas consiste à rester proche du dernier cours affiché. Cela prolongerait la situation actuelle. Ce n’est pas une annonce que cela arrivera.`,
   `Un autre cas consiste à dépasser la baisse déjà mesurée depuis un sommet. À partir de là, le risque passé ne décrit plus ce qui se passe. L’inverse existe aussi : reprendre le terrain déjà perdu. Le dossier ne choisit pas entre ces possibilités.`,
   guard
  ],
  summary:[
   `Je prépare un résumé de ${name}, court, mais tenu par le dossier. Ce qui n’est pas affiché ne sera pas résumé comme si cela l’était.`,
   `Source utilisée : ${source}. Je ne la remplace pas, et je ne complète pas son silence par une autre information.`,
   hole,
   `Le résumé peut dire où en est le cours affiché, comment la fenêtre s’est terminée par rapport à son début, et quelle baisse a déjà été vue. Il ne peut pas dire ce qu’il faut faire, ni ce que fera le prochain cours.`,
   guard
  ],
  refuse:[
   `La question demande un conseil, un objectif ou une probabilité pour ${name}. Cette partie-là, je ne la fournis pas, même si elle est formulée comme une analyse.`,
   `Je peux seulement revenir à ${source} et au dossier déjà calculé. Acheter, vendre, viser un prix ou donner une chance sur cent sortirait de ce dossier.`,
   hole,
   `Je vais donc répondre à côté de la demande : rappeler ce que les chiffres montrent, puis la limite. Pas la recommandation.`,
   guard
  ],
  analyse:[
   `Je prends ${name} comme une lecture complète, pas comme un signal. L’ordre sera le même que le dossier : situation, trajectoire, risque passé, puis ce que ces mesures ne disent pas.`,
   `D’abord la source : ${source}. Le cours, la variation et la date doivent rester ceux qui sont affichés. Si l’un manque, je le dis, et je ne mets rien à la place.`,
   hole,
   `La trajectoire compare les deux bouts de la fenêtre. Elle ne raconte pas le chemin jour après jour, et elle ne dit pas que le mouvement va continuer. Le dernier point au-dessus ou en dessous du premier est un fait passé.`,
   `Le risque passé se lit à part. Une performance d’un bout à l’autre et une baisse depuis un sommet ne décrivent pas le même épisode. Je les garde distincts, sans en faire un plancher de perte.`,
   `Ensuite viennent les manques. Résultats, actualité, carnet d’ordres, frais, dividendes, fiscalité : absents du dossier. Les scénarios, s’il y en a, restent des conditions. Ils n’ont ni cible ni chance chiffrée.`,
   guard
  ]
 };
 return packs[reasonKind(question)];
}
async function typeText(el,text,serial,pace){
 el.classList.add('is-writing');
 if(pace<=0){el.textContent=text;el.classList.remove('is-writing');return serial===state.generation;}
 const parts=text.split(/(\s+)/);let out='';
 for(const part of parts){
  if(serial!==state.generation){el.classList.remove('is-writing');return false;}
  out+=part;el.textContent=out;
  if(part.trim()){$('messages').scrollTop=$('messages').scrollHeight;await wait(pace);}
 }
 el.classList.remove('is-writing');
 return true;
}
async function playReasoning(box,question,serial){
 const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const status=box.querySelector('.reason-status');
 const stream=box.querySelector('.reason-stream');
 const phases=['Recherche…','Lecture du dossier…','Recoupement…','Vérification…'];
 const paragraphs=reasoningParagraphs(question);
 for(let i=0;i<paragraphs.length;i++){
  if(serial!==state.generation)return false;
  status.textContent=phases[Math.min(phases.length-1,Math.floor(i*phases.length/paragraphs.length))];
  const line=document.createElement('p');
  stream.append(line);
  const kept=await typeText(line,paragraphs[i],serial,reduce?0:48);
  if(!kept)return false;
  await wait(reduce?30:680);
 }
 if(serial!==state.generation)return false;
 status.textContent='Vérification…';
 await wait(reduce?40:1500);
 if(serial!==state.generation)return false;
 status.textContent='';
 box.classList.add('settled');
 return true;
}
async function ask(question){
 if(state.aiBusy){toast('Une réponse est déjà en cours.');return;}
 const serial=++state.generation;const assetId=state.asset.id;const ctx=context();state.aiBusy=true;$('analyst').classList.add('is-thinking');$('send').hidden=true;$('stop-ai').hidden=false;$('question').value='';
 msg(question,'user');const body=msg('','assistant','PIXR ANALYST · '+state.asset.name);
 const reason=document.createElement('div');reason.className='reason';
 reason.innerHTML='<div class="reason-head"><span class="reason-orb" aria-hidden="true"></span><span class="reason-title">Réflexion</span><span class="reason-dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="reason-status">Recherche…</span><span class="reason-time">0 s</span></div><div class="reason-stream"></div>';
 body.before(reason);
 const started=performance.now();
 const timer=setInterval(()=>{const node=reason.querySelector('.reason-time');if(node)node.textContent=`${Math.max(1,Math.round((performance.now()-started)/1000))} s`;},250);
 try{
  const kept=await playReasoning(reason,question,serial);
  if(!kept||serial!==state.generation||assetId!==state.asset.id)return;
  const answer=await generate(question,ctx,state.turns);
  if(serial!==state.generation||assetId!==state.asset.id)return;
  if(!answer.trim()){body.textContent='L’analyste n’a pas produit de réponse. Reformulez la question.';return;}
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const done=await typeText(body,answer,serial,reduce?0:22);
  if(done&&serial===state.generation&&assetId===state.asset.id)state.turns.push({role:'user',content:question},{role:'assistant',content:answer});
 }catch{if(serial===state.generation)body.textContent='L’analyse n’a pas abouti. Réessayez avec une question plus courte.';}
 finally{clearInterval(timer);if(serial===state.generation){state.aiBusy=false;$('analyst').classList.remove('is-thinking');$('send').hidden=false;$('stop-ai').hidden=true;}}
}
function modal(type){
 const contents={sources:`<div class="eyebrow">TRANSPARENCE</div><h2>Les sources, sans détour.</h2><h3>Crypto · Coinbase</h3><p>Dernier cours, variation sur 24 heures et clôtures quotidiennes. Le navigateur interroge <code>marche.php</code> sur ce site, qui lit l’API publique Coinbase. Ce sont les prix de cette plateforme, pas un prix universel.</p><h3>Devises · Frankfurter</h3><p><a href="https://frankfurter.dev/" target="_blank" rel="noopener">Frankfurter</a> est lu directement par votre navigateur. Ce sont des taux de référence quotidiens, pas des prix exécutables. La date de publication est indiquée.</p><h3>Actions, indices et marques cotées · Yahoo Finance</h3><p>La recherche interroge les marchés mondiaux via <code>marche.php</code> : sociétés, fonds, indices, devises et cryptos cotés. Nike, Toyota ou LVMH apparaissent ainsi. Une marque privée, qui n’est pas en bourse, n’a pas de cours. Les clôtures peuvent être différées selon la place. Ce n’est pas un carnet d’ordres.</p><h3>Graphiques TradingView</h3><p>Le graphique principal est celui de TradingView : zoom au doigt ou à la molette, déplacement, bougies, volumes, indicateurs, comparaisons et tracés. Changer le symbole dans ce graphique ne change pas le dossier. Ses cours ne sont pas transmis à l’analyste. Les graphiques S&P 500 et Nasdaq peuvent être des CFD, distincts de la série chiffrée. L’aperçu mondial vient aussi de TradingView.</p><h3>Analyste</h3><p>L’analyste est prêt dès l’ouverture de la page. Il rédige la lecture à partir du dossier déjà calculé, dans votre navigateur, sans téléchargement et sans envoi de la question à un service d’IA. Il peut se tromper. Une réponse qui introduirait un chiffre absent des données est écartée.</p><h3>Confidentialité</h3><p>Sans compte, les favoris et le fait que vous avez lu cet avertissement restent dans ce navigateur. Connecté à un compte Pixr, la sélection et les marques retrouvées sont enregistrées pour ce compte, dans le dossier protégé du site. Les conversations, les questions et les CSV ne sont pas envoyés. L’hébergement Pixr voit les requêtes de cours crypto et actions, puis contacte Coinbase et Yahoo Finance. Frankfurter et TradingView voient l’adresse IP du navigateur. Pixr n’utilise pas d’outil publicitaire.</p><p class="dialog-note">Aucune donnée de démonstration n’est utilisée. Une source indisponible produit un message d’erreur, jamais un cours inventé.</p>`,method:`<div class="eyebrow">NOTRE MÉTHODE</div><h2>Mesurer. Comprendre. Décider.</h2><h3>Performance</h3><p><code>(dernière clôture / première clôture − 1) × 100</code>. Calculée sur la période sélectionnée, hors dividendes, frais et fiscalité.</p><h3>Volatilité annualisée</h3><p>Écart-type des rendements logarithmiques successifs, multiplié par la racine du nombre d’observations par année. L’annualisation utilise les jours écoulés. Les périodes courtes ou les données manquantes rendent cette estimation plus fragile.</p><h3>Baisse maximale</h3><p>Plus forte baisse d’une clôture depuis un sommet précédent, sur la période affichée. Elle ne représente ni un plafond de perte future ni les baisses survenues entre deux clôtures.</p><h3>L’analyste développe la lecture</h3><p>Il est disponible immédiatement. Il reçoit le nom de l’actif, sa description, la source, le cours, les mesures et les dernières clôtures. Il rédige la situation, la trajectoire, le risque passé, la lecture, les zones d’ombre, des scénarios et les limites. Il ne cite que les chiffres de ce dossier. Ce n’est pas un conseil en investissement.</p><h3>Importer vos données</h3><p>Pour les actions et indices, un CSV <code>Date,Close</code> peut remplacer la série. Dates <code>AAAA-MM-JJ</code>, prix positifs. Le fichier reste sur votre appareil et sa provenance n’est pas vérifiée.</p>`};
 $('dialog-content').innerHTML=contents[type];$('info-dialog').showModal();
}
function showDisclaimer(){
 let seen=false;try{seen=localStorage.getItem('pixr-ai-disclaimer')==='1'}catch{}
 if(seen)return;
 $('disclaimer-dialog').showModal();
}
let searchTimer=0;$('search').addEventListener('input',()=>{list();clearTimeout(searchTimer);searchTimer=setTimeout(searchWorld,280)});
document.addEventListener('click',e=>{
 const selectButton=e.target.closest('[data-select]');if(selectButton){select(selectButton.dataset.select);return;}
 const filter=e.target.closest('[data-kind]');if(filter){state.kind=filter.dataset.kind;document.querySelectorAll('[data-kind]').forEach(b=>b.classList.toggle('selected',b===filter));list();return;}
 const pageButton=e.target.closest('nav [data-page]');if(pageButton){showPage(pageButton.dataset.page);return;}
 const fold=e.target.closest('[data-collapse]');if(fold){togglePane(fold.dataset.collapse);return;}
 const period=e.target.closest('[data-period]');if(period){if(state.period!==period.dataset.period){state.period=period.dataset.period;persistSelection();select(state.asset.id,true)}return;}
 const action=e.target.closest('[data-ask]');if(action){const questions={analyse:'Fais une analyse approfondie de cet actif. Développe la situation, la trajectoire, le risque passé, la lecture, les zones d’ombre, des scénarios conditionnels et les limites. N’utilise que les chiffres du dossier.',summary:'Résume en profondeur ce que les données disponibles permettent de comprendre, et ce qu’elles ne permettent pas de conclure.',risks:'Développe les risques observables à partir des mesures du dossier, et sépare-les clairement de ce que les données ne montrent pas.',scenarios:'Présente des scénarios conditionnels pour cet actif, sans prix cible ni probabilité chiffrée.',blind:'Quelles zones d’ombre restent après la lecture de ce dossier, et quelles données manqueraient pour aller plus loin ?'};ask(questions[action.dataset.ask]);}
});
const account={user:null,csrf:'',google:'',timer:0};
let accountMute=false,accountDirty=false,accountMode='login';
function persistSelection(){
 try{localStorage.setItem('pixr-favorites',JSON.stringify([...favorites]));}
 catch{if(!account.user)toast('Le navigateur ne permet pas de sauvegarder les favoris.');}
 persistFound();
 if(account.user&&!accountMute)scheduleAccountSave();
}
function accountBody(){return {action:'save',favorites:[...favorites],found:foundRows(),period:state.period};}
async function accountFetch(method,body){
 const opts={method,credentials:'same-origin',headers:{Accept:'application/json'}};
 if(body){opts.headers['Content-Type']='application/json'; opts.body=JSON.stringify({...body,csrf:account.csrf});}
 const response=await fetch('compte.php',opts);
 const data=await response.json().catch(()=>null);
 if(!data||typeof data!=='object')throw new Error('Le compte Pixr ne répond pas. Cette page doit être servie avec PHP.');
 if(data.csrf)account.csrf=data.csrf;
 if(typeof data.google==='string'&&data.google.startsWith('https://cloud.pixr.dev/auth/google_start.php'))account.google=data.google;
 return data;
}
function scheduleAccountSave(){if(!account.user||accountMute)return; accountDirty=true; clearTimeout(account.timer); account.timer=setTimeout(()=>flushAccount(),400);}
async function flushAccount(){
 if(!account.user||accountMute||!accountDirty)return;
 clearTimeout(account.timer); accountDirty=false;
 try{const data=await accountFetch('POST',accountBody()); if(!data.ok){accountDirty=true; toast(data.message||'La sélection n’a pas été enregistrée sur le compte.');}}
 catch{accountDirty=true; toast('La sélection n’a pas été enregistrée sur le compte.');}
}
function deviceSnapshot(){try{if(localStorage.getItem('pixr-device-held')==='1')return; localStorage.setItem('pixr-device-favorites',localStorage.getItem('pixr-favorites')||'[]'); localStorage.setItem('pixr-device-found',localStorage.getItem('pixr-found')||'[]'); localStorage.setItem('pixr-device-held','1');}catch{}}
function reloadStored(){favorites=new Set(readIds('pixr-favorites')||['BTC','SPX','AAPL','EURCHF']); discovered.clear(); loadFound('pixr-found');}
function restoreDevice(){try{if(localStorage.getItem('pixr-device-held')==='1'){localStorage.setItem('pixr-favorites',localStorage.getItem('pixr-device-favorites')||'[]'); localStorage.setItem('pixr-found',localStorage.getItem('pixr-device-found')||'[]'); localStorage.removeItem('pixr-device-held');}}catch{} reloadStored();}
function applyAccountState(bag){
 accountMute=true;
 try{
  favorites=new Set(Array.isArray(bag.favorites)?bag.favorites.filter(x=>typeof x==='string'):[]);
  discovered.clear();
  if(Array.isArray(bag.found)) for(const hit of bag.found){const asset=assetFromListing(hit); if(asset?.searched) discovered.set(asset.id,asset);}
  try{localStorage.setItem('pixr-favorites',JSON.stringify([...favorites])); persistFound();}catch{}
  const period=bag.period;
  const periodChanged=typeof period==='string'&&period!==state.period&&['1M','6M','1Y','5Y'].includes(period);
  if(periodChanged)state.period=period;
  setFavorite(); list();
  if(state.page==='selection')renderSelection();
  if(periodChanged)select(state.asset.id,true);
 }finally{accountMute=false;}
}
function paintAccount(){
 const button=$('account-open'); if(!button)return;
 const label=$('space-label');
 if(account.user){
  const name=account.user.name||account.user.email||'Compte';
  button.textContent=name; button.classList.add('is-in'); button.title='Compte Pixr connecté';
  if(label)label.textContent='Compte Pixr';
 }else{
  button.textContent='Connexion'; button.classList.remove('is-in'); button.title='Se connecter à un compte Pixr';
  if(label)label.textContent='Espace personnel';
 }
}
function accountError(text){const el=$('account-error'); if(!el)return; el.hidden=!text; el.textContent=text||'';}
function showAccount(mode){
 accountMode=mode;
 const inside=mode==='in'&&!!account.user;
 $('account-in').hidden=!inside; $('account-form').hidden=inside;
 if(inside){$('account-who').textContent=account.user.name?`${account.user.name} · ${account.user.email}`:(account.user.email||''); return;}
 const register=mode==='register', code=mode==='code';
 $('account-password-label').hidden=code; $('account-confirm-label').hidden=!register; $('account-code-label').hidden=!code;
 $('account-password').required=!code; $('account-confirm').required=register; $('account-code').required=code;
 $('account-email').readOnly=code;
 $('account-password').autocomplete=register?'new-password':'current-password';
 $('account-submit').textContent=code?'Valider le code':register?'Créer le compte':'Se connecter';
 $('account-switch').textContent=register||code?'J’ai déjà un compte':'Créer un compte';
 $('account-google').hidden=!(account.google&&mode==='login');
 accountError('');
}
function adoptAccount(data,announce){
 deviceSnapshot(); account.user=data.user||null; if(data.csrf)account.csrf=data.csrf; paintAccount();
 if(data.fresh){scheduleAccountSave(); if(announce)toast('Connecté. La sélection de cet appareil est enregistrée sur le compte.');}
 else{applyAccountState(data.state||{favorites:[],found:[],period:state.period}); if(announce)toast('Connecté. La sélection du compte est chargée.');}
}
async function bootAccount(){
 try{
  const data=await accountFetch('GET');
  paintAccount();
  if(data.ok&&data.user)adoptAccount(data,false);
 }catch{paintAccount();}
}
$('favorite').onclick=()=>{const id=state.asset.id;favorites.has(id)?favorites.delete(id):favorites.add(id);persistSelection();setFavorite();list();if(state.page==='selection')renderSelection();};
$('account-open').onclick=()=>{showAccount(account.user?'in':'login'); $('account-password').value=''; $('account-confirm').value=''; $('account-code').value=''; $('account-dialog').showModal(); if(!account.user)$('account-email').focus();};
$('account-close').onclick=()=>$('account-dialog').close();
$('account-dialog').addEventListener('click',e=>{if(e.target===$('account-dialog')){const r=e.target.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('account-switch').onclick=()=>showAccount(accountMode==='login'?'register':'login');
$('account-google').onclick=()=>{if(account.google)location.href=account.google;};
$('account-form').onsubmit=async e=>{
 e.preventDefault(); accountError(''); const submit=$('account-submit'); submit.disabled=true;
 try{
  const data=await accountFetch('POST',{action:accountMode,email:$('account-email').value.trim(),password:$('account-password').value,password_confirm:$('account-confirm').value,code:$('account-code').value.trim(),website:$('account-website').value});
  if(data.need_code){if(data.email)$('account-email').value=data.email; showAccount('code'); toast('Un code a été envoyé par email.'); return;}
  if(!data.ok||!data.user){accountError(data.message||'Connexion impossible.'); return;}
  $('account-password').value=''; $('account-confirm').value=''; $('account-code').value='';
  adoptAccount(data,true); $('account-dialog').close();
 }catch(err){accountError(err.message||'Le compte Pixr ne répond pas.');}
 finally{submit.disabled=false;}
};
$('account-logout').onclick=async()=>{
 const button=$('account-logout'); button.disabled=true;
 try{
  const data=await accountFetch('POST',{action:'logout'});
  account.user=null; accountDirty=false; clearTimeout(account.timer); if(data.csrf)account.csrf=data.csrf;
  restoreDevice(); paintAccount(); setFavorite(); list(); if(state.page==='selection')renderSelection();
  $('account-dialog').close(); toast('Déconnecté. Cet appareil a retrouvé sa sélection.');
 }catch(err){toast(err.message||'La déconnexion n’a pas abouti.');}
 finally{button.disabled=false;}
};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')void flushAccount();});
$('stop-ai').onclick=()=>{interrupt();msg('Génération arrêtée.','info')};
$('clear-chat').onclick=()=>{interrupt();resetMessages()};
$('chat-form').onsubmit=e=>{e.preventDefault();const q=$('question').value.trim();if(q)ask(q)};
$('question').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('chat-form').requestSubmit()}});
$('refresh').onclick=async()=>{$('refresh').disabled=true;await Promise.allSettled([pulses(),select(state.asset.id,true)]);$('refresh').disabled=false;toast('Sources interrogées. Les cours peuvent être mis en cache une minute.');};
for(const id of ['sources-open','footer-sources'])$(id).onclick=()=>modal('sources');
$('explain-metrics').onclick=()=>modal('method');
$('dialog-close').onclick=()=>$('info-dialog').close();
$('info-dialog').addEventListener('click',e=>{if(e.target===$('info-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('disclaimer-ok').onclick=()=>{try{localStorage.setItem('pixr-ai-disclaimer','1')}catch{} $('disclaimer-dialog').close();};
$('import-open').onclick=()=>$('csv-file').click();
$('csv-file').onchange=async()=>{const file=$('csv-file').files[0],id=state.asset.id;if(!file)return;try{if(file.size>2e6)throw new Error('Le fichier doit faire moins de 2 Mo.');const series=parseCSV(await file.text());state.imported.set(id,{series,name:file.name});if(state.asset.id===id)await select(id);toast('Historique importé localement.')}catch(e){toast(e.message)}finally{$('csv-file').value=''}};
$('download-csv').onclick=()=>{if(!state.series.length)return;const content='Date,Close\n'+state.series.map(p=>`${new Date(p.time).toISOString().slice(0,10)},${p.value}`).join('\n');const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`pixr-${state.asset.id}-${state.period}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('copy-dossier').onclick=async()=>{try{await navigator.clipboard.writeText($('ai-dossier').innerText.trim());toast('Dossier copié.');}catch{toast('La copie n’est pas autorisée par le navigateur.');}};
$('today').textContent=new Date().toLocaleDateString('fr-CH',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const lineChart=$('line-chart');
const chartFingers=new Map();
let chartPinch=null,chartDrag=null;
function chartRatio(clientX){const rect=lineChart.getBoundingClientRect();return Math.max(0,Math.min(1,(clientX-rect.left)/Math.max(rect.width,1)));}
function showCursor(clientX){if(lineChart.hidden||state.series.length<2)return;const {i0,i1}=chartBounds();chartCursor=Math.round(chartRatio(clientX)*Math.max(1,i1-i0));drawChart();}
lineChart.tabIndex=0;
lineChart.setAttribute('aria-label','Graphique de la série sourcée. Molette ou pincement pour zoomer, glisser pour se déplacer.');
lineChart.addEventListener('wheel',e=>{if(lineChart.hidden||state.series.length<4)return;e.preventDefault();zoomChart(e.deltaY>0?1.22:0.8,chartRatio(e.clientX));},{passive:false});
lineChart.addEventListener('pointerdown',e=>{if(lineChart.hidden||e.button!==0)return;lineChart.setPointerCapture(e.pointerId);chartFingers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(chartFingers.size>=2){const pts=[...chartFingers.values()];const bounds=chartBounds();chartPinch={dist:Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y)||1,i0:bounds.i0,i1:bounds.i1};chartDrag=null;}else{const bounds=chartBounds();chartDrag={x:e.clientX};chartPinch=null;}});
lineChart.addEventListener('pointermove',e=>{if(!chartFingers.has(e.pointerId)){showCursor(e.clientX);return;}chartFingers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(chartFingers.size>=2&&chartPinch){const pts=[...chartFingers.values()];const dist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y)||1;const span=Math.max(2,chartPinch.i1-chartPinch.i0);const next=Math.max(8,Math.min(state.series.length-1,Math.round(span*chartPinch.dist/dist)));const mid=(chartPinch.i0+chartPinch.i1)/2;let a=Math.round(mid-next/2),b=a+next,n=state.series.length;if(a<0){b-=a;a=0;}if(b>n-1){a-=b-(n-1);b=n-1;}chartView={i0:Math.max(0,a),i1:Math.min(n-1,b)};drawChart();return;}if(chartDrag){panChart(e.clientX-chartDrag.x,lineChart.getBoundingClientRect().width);chartDrag.x=e.clientX;return;}showCursor(e.clientX);});
function releaseChartFinger(e){chartFingers.delete(e.pointerId);if(chartFingers.size<2)chartPinch=null;if(!chartFingers.size)chartDrag=null;}
lineChart.addEventListener('pointerup',releaseChartFinger);
lineChart.addEventListener('pointercancel',releaseChartFinger);
lineChart.addEventListener('pointerleave',()=>{if(chartFingers.size||lineChart.hidden)return;chartCursor=null;if(state.series.length>1)drawChart();});
lineChart.addEventListener('dblclick',()=>{chartView=null;chartCursor=null;if(state.series.length>1)drawChart();});
lineChart.addEventListener('keydown',e=>{if(lineChart.hidden||state.series.length<4)return;if(e.key==='+'||e.key==='='||e.key==='ArrowUp'){e.preventDefault();zoomChart(0.8,0.5);}else if(e.key==='-'||e.key==='ArrowDown'){e.preventDefault();zoomChart(1.25,0.5);}else if(e.key==='ArrowLeft'){e.preventDefault();panChart(90,lineChart.getBoundingClientRect().width);}else if(e.key==='ArrowRight'){e.preventDefault();panChart(-90,lineChart.getBoundingClientRect().width);}else if(e.key==='Home'||e.key==='0'){chartView=null;drawChart();}});
applyPanes();
bindSplitter($('split-explorer'),'explorer',1,200,560);
bindSplitter($('split-analyst'),'analyst',-1,280,760);
bindSplitter($('split-chart'),'chart',1,480,980);
window.addEventListener('resize',applyPanes);
let opening='overview';try{const saved=sessionStorage.getItem('pixr-page');if(pages[saved])opening=saved;}catch{}
showPage(opening,false);
list();pulses();select(state.asset.id);world();showDisclaimer();bootAccount();
scheme.addEventListener('change',()=>{if(state.series.length>1)drawChart();world();const symbol=tradingViewSymbol(state.asset);if(!$('tv-chart').hidden&&symbol&&!state.imported.has(state.asset.id))tvChart(symbol);});
narrowScreen.addEventListener('change',()=>{const symbol=tradingViewSymbol(state.asset);if(!$('tv-chart').hidden&&symbol&&!state.imported.has(state.asset.id))tvChart(symbol);});
setInterval(()=>{if(document.visibilityState!=='visible')return;pulses();if(state.asset.kind==='crypto'||state.asset.kind==='fx'||state.asset.chart){const id=state.asset.id;quote(state.asset).then(q=>{if(state.asset.id===id){state.q=q;renderQuote(q,state.asset);renderDossier();}}).catch(()=>{});}},90000);
