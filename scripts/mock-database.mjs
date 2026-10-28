// Development/test fixture only. Production functions never import this module.
export const MOCK_SECRET='sb_secret_local_preview_only';
export const MOCK_PASSWORD='PreviewOnlyPassword123!';
export const MOCK_URL='https://workshop-preview.supabase.co';
export function makeMockDatabase(){
 const rows=Array.from({length:11},(_,i)=>({participant_id:i+1,vote_token:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),choice:null,updated_at:'2026-10-28T00:00:00.000Z'}));
 const calls=[];
 const fetchMock=async(input,options={})=>{
  const url=new URL(input);calls.push({url:String(input),method:options.method||'GET',headers:options.headers,body:options.body});
  if(url.origin!==MOCK_URL||url.pathname!=='/rest/v1/workshop_votes')throw new Error('Unexpected mock request');
  if(options.headers?.apikey!==MOCK_SECRET)return new Response(JSON.stringify({message:'denied'}),{status:401});
  let selected=rows;
  const token=url.searchParams.get('vote_token');if(token){if(!token.startsWith('eq.'))throw new Error('Invalid token filter');selected=selected.filter(r=>r.vote_token===token.slice(3));}
  const no=url.searchParams.get('participant_id');if(no&&no!=='gte.1')throw new Error('Unexpected participant filter');
  if(options.method==='PATCH'){const values=JSON.parse(options.body);if(Object.keys(values).some(k=>!['choice','updated_at'].includes(k)))throw new Error('Unexpected mutation');for(const row of selected)Object.assign(row,values);}
  else if(options.method&&options.method!=='GET')throw new Error('Unexpected method');
  const columns=(url.searchParams.get('select')||'').split(',');
  return new Response(JSON.stringify(selected.map(r=>Object.fromEntries(columns.map(k=>[k,r[k]])))),{status:200,headers:{'Content-Type':'application/json'}});
 };
 return {rows,calls,fetchMock};
}
