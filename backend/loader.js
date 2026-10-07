'use strict';
require('bytenode');

const Module = require('module');
const fs = require('fs');
const path = require('path');

const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) {
  try {
    return originalResolve.call(this, request, parent, isMain, options);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      const jscRequest = request.replace(/\.js$/, '') + '.jsc';
      try {
        return originalResolve.call(this, jscRequest, parent, isMain, options);
      } catch (_) {}
      try {
        const parentDir = parent ? path.dirname(parent.filename) : __dirname;
        const resolved = path.resolve(parentDir, request.replace(/\.js$/, '') + '.jsc');
        if (fs.existsSync(resolved)) return resolved;
      } catch (_) {}
    }
    throw err;
  }
};

require('./dist/src/server.jsc');