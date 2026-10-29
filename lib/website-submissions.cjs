'use strict';
const crypto = require('node:crypto');

function createSubmissionClient(env = process.env, fetcher = fetch, now = Date.now) {
  return async request => {
    const endpoint = env.WEBSITE_FORMS_URL || '';
    const secret = env.WEBSITE_FORMS_SECRET || '';
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(endpoint) || !/^[a-f0-9]{64}$/.test(secret)) throw new Error('Submission storage is not configured');
    if (!['pin','pdf','enquiry'].includes(request.kind) || !/^[a-f0-9]{64}$/.test(request.id)) throw new Error('Invalid submission');
    // Only these fields leave the server. Never forward the CV, PIN, cookies or IP.
    const payload = Buffer.from(JSON.stringify({version:1,timestamp:Math.floor(now()/1000),id:request.id,kind:request.kind,name:request.name,email:request.email,message:request.message || '',source:request.kind === 'enquiry' ? '/contact' : '/digital-cv'})).toString('base64');
    const signature = crypto.createHmac('sha256',secret).update(payload).digest('hex');
    const response = await fetcher(endpoint,{
      method:'POST',headers:{'Content-Type':'application/json'},redirect:'follow',
      signal:AbortSignal.timeout(20000),body:JSON.stringify({payload,signature})
    });
    if (!response.ok) throw new Error('Submission storage is unavailable');
    const result = await response.json();
    if (result.ok !== true || result.stored !== true || result.id !== request.id) throw new Error('Submission storage did not confirm the request');
    return {id:result.id,stored:true,notification:result.notification,preview:false};
  };
}

module.exports = {createSubmissionClient};
