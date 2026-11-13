'use strict';
// Deliberately unavailable on hosted deployments until a separate durable, private backend is configured.
module.exports=(req,res)=>{res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');res.statusCode=503;res.end('Private workspace is available in the local draft only.');};
