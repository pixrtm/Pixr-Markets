import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {handleMarket} from './src/market-gateway.js';
const root=fileURLToPath(new URL('./',import.meta.url));
const port=Number(process.env.PIXR_PORT||8765);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ico':'image/x-icon','.wasm':'application/wasm','.json':'application/json'};
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname==='/marche.php'||pathname.endsWith('/marche.php')){
   const result=await handleMarket(req.url);
   res.writeHead(result.status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=60','X-Content-Type-Options':'nosniff'});
   res.end(result.body);return;
  }
  let path=resolve(root,'.'+pathname);
  if(path!==resolve(root)&&!path.startsWith(resolve(root)+sep)){res.writeHead(403);res.end();return;}
  if((await stat(path)).isDirectory())path=resolve(path,'index.html');
  const content=await readFile(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(content);
 }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Page introuvable');}
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Le port ${port} est occupé. Fermez l’autre instance ou choisissez PIXR_PORT=8766.`:error.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>{
 const url=`http://127.0.0.1:${port}/`;console.log(`Pixr Markets : ${url}\nGardez cette fenêtre ouverte. Ctrl+C pour arrêter.`);
 if(process.argv.includes('--open')){
  const command=process.platform==='darwin'?'open':process.platform==='win32'?'explorer':'xdg-open';
  const child=spawn(command,[url],{stdio:'ignore'});child.on('error',()=>{});child.unref();
 }
});
