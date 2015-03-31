///<reference path='../definitions/ref.d.ts'/>
var tsApi = require('./tsapi');
var project = require('./project');
var fs = require('fs');
var path = require('path');
var Host = (function () {
    function Host(typescript, currentDirectory, files, externalResolve) {
        var _this = this;
        this.getCurrentDirectory = function () {
            return _this.currentDirectory;
        };
        this.writeFile = function (filename, data, writeByteOrderMark, onError) {
            _this.output[filename] = data;
        };
        this.getSourceFile = function (filename, languageVersion, onError) {
            var text;
            var normalizedFilename = project.Project.normalizePath(filename);
            if (_this.files[normalizedFilename]) {
                if (_this.files[normalizedFilename] === project.Project.unresolvedFile) {
                    return undefined;
                }
                else {
                    return _this.files[normalizedFilename].ts;
                }
            }
            else if (normalizedFilename === '__lib.d.ts') {
                return Host.getLibDefault(_this.typescript);
            }
            else {
                if (_this.externalResolve) {
                    try {
                        text = fs.readFileSync(filename).toString('utf8');
                    }
                    catch (ex) {
                        return undefined;
                    }
                }
            }
            if (typeof text !== 'string')
                return undefined;
            var file = tsApi.createSourceFile(_this.typescript, filename, text, languageVersion);
            _this.files[normalizedFilename] = {
                filename: normalizedFilename,
                originalFilename: filename,
                content: text,
                ts: file
            };
            return file;
        };
        this.typescript = typescript;
        this.currentDirectory = currentDirectory;
        this.files = files;
        this.externalResolve = externalResolve;
        this.reset();
    }
    Host.getLibDefault = function (typescript) {
        var filename;
        for (var i in require.cache) {
            if (!Object.prototype.hasOwnProperty.call(require.cache, i))
                continue;
            if (require.cache[i].exports === typescript) {
                filename = i;
            }
        }
        if (filename === undefined) {
            return undefined; // Not found
        }
        if (this.libDefault[filename]) {
            return this.libDefault[filename]; // Already loaded
        }
        var content = fs.readFileSync(path.resolve(path.dirname(filename) + '/lib.d.ts')).toString('utf8');
        return this.libDefault[filename] = tsApi.createSourceFile(typescript, '__lib.d.ts', content, 0 /* ES3 */); // Will also work for ES5 & 6
    };
    Host.prototype.reset = function () {
        this.output = {};
    };
    Host.prototype.getNewLine = function () {
        return '\n';
    };
    Host.prototype.useCaseSensitiveFileNames = function () {
        return false;
    };
    Host.prototype.getCanonicalFileName = function (filename) {
        return project.Project.normalizePath(filename);
    };
    Host.prototype.getDefaultLibFilename = function () {
        return '__lib.d.ts';
    };
    Host.prototype.getDefaultLibFileName = function () {
        return '__lib.d.ts';
    };
    Host.prototype.getFileData = function (filename) {
        return this.files[project.Project.normalizePath(filename)];
    };
    Host.libDefault = {};
    return Host;
})();
exports.Host = Host;
