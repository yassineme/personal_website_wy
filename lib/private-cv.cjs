'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const TTL = 8 * 60 * 60;
const AAD = Buffer.from('wyassine-private-cv-v1');
const hash = value => crypto.createHash('sha256').update(value).digest();
const same = (a, b) => crypto.timingSafeEqual(hash(a), hash(b));

const {gate, PIN_SCRIPT_HASH} = require('./cv-access-ui.cjs');
const {createSubmissionClient} = require('./website-submissions.cjs');

function configuration(env) {
  const pin = env.CV_ACCESS_PIN;
  const key = Buffer.from(env.CV_DATA_KEY || '', 'base64');
  if (typeof pin !== 'string' || !/^[0-9]{8}$/.test(pin) || key.length !== 32) return null;
  return {pin, key, sessionKey: crypto.createHmac('sha256', key).update('cv-pin-session-v2:' + pin).digest()};
}

function sign(value, key) { return crypto.createHmac('sha256', key).update(value).digest('base64url'); }
function issue(config, now) {
  const payload = Buffer.from(JSON.stringify({exp: now + TTL, nonce: crypto.randomBytes(16).toString('base64url')})).toString('base64url');
  return payload + '.' + sign(payload, config.sessionKey);
}
function valid(token, config, now) {
  if (typeof token !== 'string' || token.length > 500 || !/^[\w-]+\.[\w-]+$/.test(token)) return false;
  const [payload, signature] = token.split('.');
  if (!same(signature, sign(payload, config.sessionKey))) return false;
  try {
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof value.exp === 'number' && value.exp > now && value.exp <= now + TTL + 30 && typeof value.nonce === 'string';
  } catch { return false; }
}
function cookieValue(header, name) {
  const values = String(header || '').split(';').map(x => x.trim()).filter(x => x.startsWith(name + '='));
  return values.length === 1 ? values[0].slice(name.length + 1) : '';
}
function sameOrigin(req, secure) {
  try {
    const origin = new URL(req.headers.origin);
    return origin.protocol === (secure ? 'https:' : 'http:') && origin.host.toLowerCase() === String(req.headers.host || '').toLowerCase();
  } catch { return false; }
}
async function body(req) {
  if (req.headers['content-type']?.split(';')[0].trim() !== 'application/x-www-form-urlencoded') throw Object.assign(new Error(), {status: 415});
  let raw = req.body;
  if (raw && typeof raw === 'object' && !Buffer.isBuffer(raw)) {
    // Vercel may pre-parse repeated form fields into arrays; preserve all eight boxes.
    const fields = new URLSearchParams();
    for (const [name, value] of Object.entries(raw)) {
      for (const entry of Array.isArray(value) ? value : [value]) {
        if (typeof entry !== 'string') throw Object.assign(new Error(), {status: 400});
        fields.append(name, entry);
      }
    }
    const encoded = fields.toString();
    if (Buffer.byteLength(encoded) > 16384) throw Object.assign(new Error(), {status: 413});
    return new URLSearchParams(encoded);
  }
  if (raw == null) {
    const chunks = []; let bytes = 0;
    for await (const chunk of req) {
      bytes += Buffer.byteLength(chunk);
      if (bytes > 16384) throw Object.assign(new Error(), {status: 413});
      chunks.push(Buffer.from(chunk));
    }
    raw = Buffer.concat(chunks);
  }
  if (Buffer.byteLength(raw) > 16384) throw Object.assign(new Error(), {status: 413});
  return new URLSearchParams(raw.toString());
}

function requestToken(kind, config, time) {
  const value = `${kind}.${time + 20 * 60}.${crypto.randomBytes(16).toString('hex')}`;
  return value + '.' + sign('cv-request:' + value, config.sessionKey);
}
function validRequestToken(token, kind, config, time) {
  if (typeof token !== 'string' || token.length > 250) return false;
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== kind || !/^[0-9]+$/.test(parts[1]) || !/^[a-f0-9]{32}$/.test(parts[2])) return false;
  const expiry = Number(parts[1]);
  return expiry > time && expiry <= time + 20 * 60 && same(parts[3], sign('cv-request:' + parts.slice(0, 3).join('.'), config.sessionKey));
}

function createHandler({env = process.env, secureCookies = true, now = () => Math.floor(Date.now() / 1000), contentPath = path.join(process.cwd(), 'lib/private-cv-content.json'), readContent = () => JSON.parse(fs.readFileSync(contentPath, 'utf8')), notify, failureDelay = () => new Promise(resolve => setTimeout(resolve, 300)), maxAttempts = 10, maxRequests = 3} = {}) {
  const name = secureCookies ? '__Host-wy-cv' : 'wy-cv-dev';
  const attempts = new Map(), requests = new Map(), submitted = new Map();
  const sendRequest = notify || createSubmissionClient(env);
  let cached;
  const cookie = (value, age) => `${name}=${value}; Path=/; Max-Age=${age}; HttpOnly; SameSite=Lax${secureCookies ? '; Secure' : ''}`;
  return async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('CDN-Cache-Control', 'no-store');
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
    res.setHeader('Vary', 'Cookie');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', `default-src 'none'; script-src ${PIN_SCRIPT_HASH}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; frame-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`);
    const send = (status, content, type = 'text/html; charset=utf-8') => { res.statusCode = status; res.setHeader('Content-Type', type); res.end(req.method === 'HEAD' ? undefined : content); };
    const redirect = location => {res.setHeader('Location', location); return send(303, '');};
    if (!['GET', 'HEAD', 'POST'].includes(req.method)) {res.setHeader('Allow', 'GET, HEAD, POST');return send(405, 'Method not allowed', 'text/plain; charset=utf-8');}
    const config = configuration(env);
    if (!config) return send(503, gate({message:'Access is temporarily unavailable.', unavailable:true}));
    const time = now();
    for (const map of [attempts, requests, submitted]) for (const [key, record] of map) if (record.until <= time) map.delete(key);
    const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
    const params = new URL(req.url, 'https://placeholder.invalid').searchParams;
    if (req.method !== 'POST' && params.get('download') === 'pdf') return redirect('/digital-cv?request=pdf');
    if (req.method === 'POST') {
      if (!sameOrigin(req, secureCookies)) return send(403, 'Request not allowed', 'text/plain; charset=utf-8');
      let fields;
      try {fields = await body(req);} catch(error) {return send(error.status || 400, 'Invalid request', 'text/plain; charset=utf-8');}
      if (fields.getAll('action').length !== 1) return send(400,'Invalid request','text/plain; charset=utf-8');
      if (fields.get('action') === 'lock') {res.setHeader('Set-Cookie', cookie('', 0));return redirect('/digital-cv');}
      if (fields.get('action') === 'request') {
        const kind = fields.get('kind'), token = fields.get('request_token');
        if (fields.getAll('kind').length !== 1 || fields.getAll('request_token').length !== 1 || !['pin','pdf'].includes(kind) || !validRequestToken(token, kind, config, time)) return send(400, gate({message:'Please open a fresh request form and try again.'}));
        const values = {name:(fields.get('name') || '').trim(), email:(fields.get('email') || '').trim(), message:(fields.get('message') || '').trim()};
        const requestPage = message => gate({kind, token, values, message});
        if (fields.get('website') || fields.getAll('name').length !== 1 || fields.getAll('email').length !== 1 || fields.getAll('message').length !== 1 || !values.name || values.name.length > 80 || /[\r\n\x00-\x1f]/.test(values.name) || values.email.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(values.email) || values.message.length > 1000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(values.message)) return send(400, requestPage('Please enter your name and a valid email address.'));
        const id = crypto.createHash('sha256').update(token).digest('hex');
        const previous = submitted.get(id);
        if (previous) return send(200, gate({kind, success:true, preview:previous.preview}));
        const record = requests.get(ip);
        if (record && record.count >= maxRequests) {res.setHeader('Retry-After', String(Math.max(1,record.until-time)));return send(429, requestPage('You’ve made several requests. Please try again later, or email hello@wyassine.com.'));}
        if (requests.size >= 2000 && !record) requests.delete(requests.keys().next().value);
        requests.set(ip,{count:(record?.count || 0)+1,until:record?.until || time+15*60});
        try {
          const result = await sendRequest({id,kind,...values});
          const preview = result?.preview === true;
          if (submitted.size >= 2000) submitted.delete(submitted.keys().next().value);
          submitted.set(id,{until:time+20*60,preview});
          return send(200,gate({kind,success:true,preview}));
        } catch {return send(503,requestPage('Your request could not be saved. Please try again later, or email hello@wyassine.com.'));}
      }
      if (fields.get('action') !== 'unlock') return send(400,'Invalid request','text/plain; charset=utf-8');
      const single = fields.getAll('pin'), digits = fields.getAll('pin_digit');
      const pin = single.length === 1 && digits.length === 0 ? single[0] : single.length === 0 && digits.length === 8 && digits.every(digit => /^[0-9]$/.test(digit)) ? digits.join('') : null;
      if (pin === null) return send(400,'Invalid request','text/plain; charset=utf-8');
      const record = attempts.get(ip);
      if (record && record.count >= maxAttempts) {res.setHeader('Retry-After',String(Math.max(1,record.until-time)));return send(429,gate({message:'Too many attempts. Please try again in a few minutes.'}));}
      if (!/^[0-9]{8}$/.test(pin) || !same(pin,config.pin)) {
        if (attempts.size >= 2000 && !record) attempts.delete(attempts.keys().next().value);
        attempts.set(ip,{count:(record?.count || 0)+1,until:record?.until || time+15*60});
        await failureDelay();return send(401,gate({message:'That PIN did not match. Please enter the eight-digit PIN or request it from me.'}));
      }
      attempts.delete(ip);res.setHeader('Set-Cookie',cookie(issue(config,time),TTL));return redirect('/digital-cv');
    }
    const kind = params.get('request');
    if (['pin','pdf'].includes(kind)) return send(200,gate({kind,token:requestToken(kind,config,time)}));
    if (!valid(cookieValue(req.headers.cookie,name),config,time)) return send(200,gate());
    try {
      if (!cached) {
        const encrypted=readContent();if(encrypted.version!==1)throw new Error('Unsupported content');
        const decipher=crypto.createDecipheriv('aes-256-gcm',config.key,Buffer.from(encrypted.iv,'base64'));decipher.setAAD(AAD);decipher.setAuthTag(Buffer.from(encrypted.tag,'base64'));
        cached=JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext,'base64')),decipher.final()]).toString('utf8'));
      }
      res.setHeader('Content-Security-Policy',cached.csp);return send(200,cached.html);
    }catch{return send(503,gate({message:'The CV is temporarily unavailable. Please try again later.',unavailable:true}));}
  };
}

module.exports={createHandler};
