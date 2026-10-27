import {cp,rename,rm} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const dist=resolve(root,'dist');
if(process.argv.includes('--clean')){
 await rm(resolve(root,'assets'),{recursive:true,force:true});
 await rm(resolve(root,'brand'),{recursive:true,force:true});
 process.exit(0);
}
const built=resolve(dist,'index.dev.html');
const distIndex=resolve(dist,'index.html');
try{
 await rename(built,distIndex);
}catch(error){
 if(error.code!=='ENOENT')throw error;
}
await rm(resolve(root,'assets'),{recursive:true,force:true});
await rm(resolve(root,'brand'),{recursive:true,force:true});
await cp(resolve(dist,'assets'),resolve(root,'assets'),{recursive:true});
await cp(resolve(dist,'brand'),resolve(root,'brand'),{recursive:true});
await cp(distIndex,resolve(root,'index.html'));
await cp(resolve(dist,'marche.php'),resolve(root,'marche.php'));
await cp(resolve(dist,'compte.php'),resolve(root,'compte.php'));
for(const name of ['favicon-96x96.png','favicon.svg','favicon.ico','apple-touch-icon.png','site.webmanifest','web-app-manifest-192x192.png','web-app-manifest-512x512.png']){
 await cp(resolve(dist,name),resolve(root,name));
}
