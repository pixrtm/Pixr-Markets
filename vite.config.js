import {defineConfig} from 'vite';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {handleMarket} from './src/market-gateway.js';

const root=dirname(fileURLToPath(import.meta.url));

function devEntry(){
 return {name:'pixr-dev-entry',apply:'serve',configureServer(server){
  server.middlewares.use((req,_res,next)=>{
   const raw=req.url||'/';
   const q=raw.indexOf('?');
   const path=q===-1?raw:raw.slice(0,q);
   const query=q===-1?'':raw.slice(q);
   if(path==='/'||path==='/index.html')req.url='/index.dev.html'+query;
   next();
  });
 }};
}

function marketProxy(){
 const attach=server=>{
  server.middlewares.use(async(req,res,next)=>{
   const path=(req.url||'').split('?')[0];
   if(path!=='/marche.php'&&!path.endsWith('/marche.php'))return next();
   const result=await handleMarket(req.url||'');
   res.statusCode=result.status;
   res.setHeader('Content-Type','application/json; charset=utf-8');
   res.setHeader('Cache-Control','public, max-age=60');
   res.setHeader('X-Content-Type-Options','nosniff');
   res.end(result.body);
  });
 };
 return {name:'pixr-market-proxy',configureServer:attach,configurePreviewServer:attach};
}

export default defineConfig({
 base:'./',
 plugins:[devEntry(),marketProxy()],
 build:{rollupOptions:{
  input:resolve(root,'index.dev.html'),
  output:{entryFileNames(chunk){
   const name=chunk.name==='index.dev'?'index':chunk.name;
   return `assets/${name}-[hash].js`;
  }},
 }},
});
