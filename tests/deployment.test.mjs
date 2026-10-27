import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const root=project;
const siteIcons=new Set(['/pixr-markets/favicon-96x96.png','/pixr-markets/favicon.svg','/pixr-markets/favicon.ico','/pixr-markets/apple-touch-icon.png','/pixr-markets/site.webmanifest']);
test('Published HTML uses existing relative assets under a subdirectory',async()=>{
 const html=await readFile(resolve(root,'index.html'),'utf8');
 assert.doesNotMatch(html,/src=["']\.?\/?src\/main\.js/);
 assert.match(html,/href="\/pixr-markets\/favicon\.svg"/);
 assert.match(html,/content="Pixr Markets"/);
 assert.doesNotMatch(html,/\/win10\//);
 const urls=[...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m=>m[1]).filter(u=>!u.startsWith('https:')&&!u.startsWith('data:'));
 assert.ok(urls.some(u=>u.endsWith('.css')));
 assert.ok(urls.some(u=>u.endsWith('.js')));
 for(const url of urls){
  if(siteIcons.has(url)){await access(resolve(root,url.slice('/pixr-markets/'.length)));continue;}
  assert.ok(url.startsWith('./'),`Absolute asset breaks subdirectory hosting: ${url}`);
  await access(resolve(root,url));
 }
 await access(resolve(root,'marche.php'));
 const compte=await readFile(resolve(root,'compte.php'),'utf8');
 assert.match(compte,/'secret'/);
 assert.match(compte,/'markets'/);
 assert.doesNotMatch(compte,/SMTP_PASS|password_hash|GOOGLE_OAUTH_CLIENT_SECRET/);
 await access(resolve(root,'brand/logo-pixr.png'));
 await access(resolve(root,'web-app-manifest-192x192.png'));
 await access(resolve(root,'web-app-manifest-512x512.png'));
 const source=await readFile(resolve(project,'index.dev.html'),'utf8');
 assert.match(source,/src=["']\.\/src\/main\.js["']/);
 const built=await readFile(resolve(project,'dist/index.html'),'utf8');
 assert.equal(html,built);
});
