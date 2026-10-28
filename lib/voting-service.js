import { createHash, timingSafeEqual } from 'node:crypto';
export const CAPACITY = 11;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHOICES = new Set(['brunch', 'pizza']);
class PublicError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function send(res, status, data) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.statusCode = status;
  res.end(JSON.stringify(data));
}
function config() {
  const raw = (process.env.SUPABASE_URL || '').trim();
  const key = (process.env.SUPABASE_SECRET_KEY || '').trim();
  let url;
  try { url = new URL(raw); } catch { throw new PublicError(503, '서버 연결 설정이 필요합니다. 진행자에게 알려주세요.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !key || !(key.startsWith('sb_secret_') || /^eyJ[^.]+\.[^.]+\.[^.]+$/.test(key))) {
    throw new PublicError(503, '서버 연결 설정이 필요합니다. 진행자에게 알려주세요.');
  }
  return { base: url.origin, key };
}
function body(req) {
  const type = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') throw new PublicError(415, 'JSON 형식의 요청이 필요합니다.');
  let value;
  try {
    const source = req.body;
    if (Number(req.headers['content-length']) > 2048) throw new PublicError(413, '요청이 너무 큽니다.');
    const raw = typeof source === 'string' ? source : JSON.stringify(source);
    if (!raw || Buffer.byteLength(raw) > 2048) throw new PublicError(413, '요청이 너무 큽니다.');
    value = typeof source === 'string' ? JSON.parse(source) : source;
  } catch (e) {
    if (e instanceof PublicError) throw e;
    throw new PublicError(400, '요청 내용을 읽을 수 없습니다.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new PublicError(400, '올바른 요청이 아닙니다.');
  return value;
}
function checkOrigin(req) {
  // Request codes/passwords authorize requests; origin is an additional browser check.
  const origin = req.headers.origin;
  if (origin) {
    const forwarded = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    try { if (new URL(origin).host !== forwarded) throw new Error(); }
    catch { throw new PublicError(403, '현재 사이트에서 다시 요청해주세요.'); }
  }
}
async function database(method, params, values) {
  const { base, key } = config();
  const headers = { apikey: key, Accept: 'application/json' };
  // Current secret keys go in apikey; only legacy service_role JWTs also use Bearer.
  if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key;
  if (values !== undefined) {
    headers['Content-Type'] = 'application/json';
    headers.Prefer = 'return=representation';
  }
  let response;
  try {
    response = await fetch(base + '/rest/v1/workshop_votes?' + new URLSearchParams(params), {
      method, headers, body: values === undefined ? undefined : JSON.stringify(values),
      signal: AbortSignal.timeout(8500), cache: 'no-store'
    });
  } catch {
    throw new PublicError(503, '투표 서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.');
  }
  if (!response.ok) {
    // Never return provider errors, query details or credentials to a visitor.
    throw new PublicError(503, '투표 저장소를 확인하지 못했습니다. 진행자에게 알려주세요.');
  }
  let rows;
  try { rows = await response.json(); } catch { throw new PublicError(503, '투표 저장소의 응답을 확인하지 못했습니다.'); }
  if (!Array.isArray(rows)) throw new PublicError(503, '투표 저장소의 응답을 확인하지 못했습니다.');
  return rows;
}
function validateRows(rows) {
  const ids = new Set(rows.map(r => r.participant_id));
  if (rows.length !== CAPACITY || ids.size !== CAPACITY || rows.some(r => !Number.isInteger(r.participant_id) || r.participant_id < 1 || r.participant_id > CAPACITY || (r.choice !== null && !CHOICES.has(r.choice)))) {
    throw new PublicError(503, '11명용 투표 저장소가 준비되지 않았습니다. 진행자에게 알려주세요.');
  }
}
function summarize(rows) {
  validateRows(rows);
  const counts = { brunch: 0, pizza: 0 };
  rows.forEach(r => { if (r.choice) counts[r.choice]++; });
  return { capacity: CAPACITY, total: counts.brunch + counts.pizza, counts, fetchedAt: new Date().toISOString() };
}
function adminAuthorized(req) {
  const expected = process.env.WORKSHOP_ADMIN_PASSWORD || '';
  if (!/^[\x21-\x7e]{16,128}$/.test(expected)) throw new PublicError(503, '진행자 비밀번호를 Vercel에 공백 없이 영문·숫자·기호 16~128자로 설정해주세요.');
  const provided = String(req.headers.authorization || '').replace(/^Bearer /, '');
  const digest = s => createHash('sha256').update(s).digest();
  if (!timingSafeEqual(digest(provided), digest(expected))) throw new PublicError(401, '진행자 비밀번호가 올바르지 않습니다.');
}
function failure(res, e) {
  send(res, e instanceof PublicError ? e.status : 500, { error: e instanceof PublicError ? e.message : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.' });
}
export async function votesHandler(req, res) {
  try {
    if (req.method === 'GET') {
      const rows = await database('GET', { select: 'participant_id,choice', order: 'participant_id.asc' });
      return send(res, 200, summarize(rows));
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return send(res, 405, { error: '지원하지 않는 요청입니다.' }); }
    checkOrigin(req);
    const data = body(req);
    const token = typeof data.token === 'string' ? data.token.trim().toLowerCase() : '';
    if (!UUID.test(token)) throw new PublicError(400, '참여 코드를 확인해주세요.');
    if (!['identify', 'vote', 'withdraw'].includes(data.action)) throw new PublicError(400, '지원하지 않는 요청입니다.');
    if (data.action === 'vote' && !CHOICES.has(data.choice)) throw new PublicError(400, '투표할 메뉴를 확인해주세요.');
    const params = { select: 'participant_id,choice', vote_token: 'eq.' + token };
    const rows = data.action === 'identify' ? await database('GET', params) : await database('PATCH', params, {
      choice: data.action === 'withdraw' ? null : data.choice, updated_at: new Date().toISOString()
    });
    if (rows.length !== 1 || !Number.isInteger(rows[0].participant_id) || rows[0].participant_id < 1 || rows[0].participant_id > CAPACITY) throw new PublicError(401, '유효하지 않은 참여 코드입니다. 진행자에게 확인해주세요.');
    return send(res, 200, { participantId: rows[0].participant_id, choice: rows[0].choice });
  } catch (e) { failure(res, e); }
}
export async function adminHandler(req, res) {
  try {
    if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return send(res, 405, { error: '지원하지 않는 요청입니다.' }); }
    checkOrigin(req);
    adminAuthorized(req);
    const data = body(req);
    if (data.action === 'list') {
      const rows = await database('GET', { select: 'participant_id,vote_token,choice,updated_at', order: 'participant_id.asc' });
      validateRows(rows);
      if (rows.some(r => !UUID.test(r.vote_token || ''))) throw new PublicError(503, '참여 코드를 확인하지 못했습니다.');
      return send(res, 200, { ...summarize(rows), participants: rows });
    }
    if (data.action === 'reset' && data.confirm === 'RESET_ALL_VOTES') {
      const rows = await database('PATCH', { select: 'participant_id,choice', participant_id: 'gte.1' }, { choice: null, updated_at: new Date().toISOString() });
      return send(res, 200, summarize(rows));
    }
    throw new PublicError(400, '지원하지 않는 진행자 요청입니다.');
  } catch (e) { failure(res, e); }
}
