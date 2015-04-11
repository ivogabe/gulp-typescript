///<reference path='../definitions/ref.d.ts'/>
var path = require('path');
function normalizePath(pathString) {
    return path.normalize(pathString).toLowerCase();
}
exports.normalizePath = normalizePath;
