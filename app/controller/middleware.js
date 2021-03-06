'use strict';

async function preOperationData(ctx, module, request_id, request_headers,
  request_method, request_url, request_body, response_status, 
  response_body, phase) {
  const userId = request_headers['X-User-Id'];
  const projectId = request_headers['X-Project-Id'];
  const domainId = request_headers['X-Project-Domain-Id'];

  let catalog = [];
  if (request_headers['X-Service-Catalog']) {
    catalog = JSON.parse(request_headers['X-Service-Catalog']);
  }
  let targetUrl = null;
  let targetRegion = null;
  let targetPath = '';
  const reg = new RegExp(`^${module}`);
  const endpoint = catalog.filter(c => reg.test(c.name));
  endpoint.forEach(endpoint => {
    const endpoints = endpoint.endpoints;
    let found = false;
    endpoints.some(e => {
      const url = new RegExp(e.publicURL);
      if (url.test(request_url)) {
        targetUrl = url;
        targetRegion = e.region;
        targetPath = request_url.replace(targetUrl, '').replace(/^\//, '');
        found = true;
        return true;
      }
    });
    return found;
  });
  const pathArray = targetPath.split('/').map(k => k.replace(/^(.*)\-/g, ''));
  if (pathArray.length > 0 && /v(\d)/.test(pathArray[0])) {
    pathArray.shift();
  }
  const service = ctx.service;
  const opt = {
    "module": module,
    "tag": pathArray[0].replace(/(e*)s$/, '$1'),
    "region": targetRegion,
    "catalog": catalog,
    "request": request_body,
    "response": response_body,
    "requestUrl": request_url,
    "requestMethod": request_method,
    "userId": userId,
    "projectId": projectId,
    "domainId": domainId,
    "requestId": request_id,
    "responseStatus": response_status,
    "phase": phase,
  };
  if (service && service[module] && service[module][opt.tag]) {
    const res = await ctx.service[module][opt.tag][request_method](opt);
  } else if (service && service[module] && typeof ctx.service[module][request_method] === 'function') {
    const res = await ctx.service[module][request_method](opt);
  } else {
    const res = await ctx.service.common[request_method](opt);
  }
}

exports.catch = async(ctx) => {
  const req = ctx.request;

  if (/^\/keystone/.test(req.url)) {
    ctx.body = 'Done';
    return;
  }

  const {
    request_method,
    request_url,
    request_id,
    response_status,
    request_headers,
  } = req.body;

  let request_body = req.body.request_body;
  let response_body = req.body.response_text;
  try {
    request_body = JSON.parse(request_body);
  } catch (e) {

  }

  try {
    response_body = JSON.parse(response_body);
  } catch (e) {

  }
  const o = {
    request_method,
    request_body,
    request_url,
    request_id,
    response_status,
  };
  const module = ctx.params.module;
  if (o.response_status) {
    const statusCode = parseInt(o.response_status, 10);
    if (statusCode < 400) {
      await preOperationData(ctx, module, request_id, request_headers,
        request_method, request_url, request_body, response_status, response_body, 'after');
    }
  } else {
    await preOperationData(ctx, module, request_id, request_headers,
      request_method, request_url, request_body, response_status, response_body, 'before');
  }
  ctx.body = 'Done';
}