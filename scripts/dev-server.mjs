// Local preview adapter. The --mock option uses explicitly labeled practice data.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import votesHandler from '../api/votes.js';
import adminHandler from '../api/admin.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../public');
const mock=process.argv.includes('--mock');
if(mock){
 const {makeMockDatabase,MOCK_SECRET,MOCK_PASSWORD,MOCK_URL}=await import('./mock-database.mjs');
 const db=makeMockDatabase();process.env.SUPABASE_URL=MOCK_URL;process.env.SUPABASE_SECRET_KEY=MOCK_SECRET;process.env.WORKSHOP_ADMIN_PASSWORD=MOCK_PASSWORD;globalThis.fetch=db.fetchMock;
}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/votes'||url.pathname==='/api/admin'){
   let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>2048){res.writeHead(413,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'요청이 너무 큽니다.'}));return;}}req.body=raw;
   if(mock){const end=res.end.bind(res);res.end=(value,...args)=>{if(res.statusCode===200&&typeof value==='string'){const data=JSON.parse(value);data.demo=true;value=JSON.stringify(data);}return end(value,...args);};}
   return await(url.pathname==='/api/votes'?votesHandler:adminHandler)(req,res);
  }
  let relative=decodeURIComponent(url.pathname);if(relative==='/')relative='/index.html';
  const filename=path.resolve(root,'.'+relative);
  if(!filename.startsWith(root+path.sep)){res.writeHead(404);res.end('Not found');return;}
  const data=await fs.readFile(filename);const ext=path.extname(filename);res.writeHead(200,{'Content-Type':ext==='.html'?'text/html; charset=utf-8':ext==='.js'?'text/javascript; charset=utf-8':'application/octet-stream','Cache-Control':'no-store','Referrer-Policy':'no-referrer'});res.end(data);
 }catch{if(!res.headersSent)res.writeHead(404);res.end('Not found');}
});
const portFlag=process.argv.indexOf('--port');
const port=Number(portFlag>=0?process.argv[portFlag+1]:(process.env.PORT||3000));server.listen(port,'0.0.0.0',()=>console.log('Local preview ready on port '+port+(mock?' (PRACTICE DATA ONLY)':'')));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
