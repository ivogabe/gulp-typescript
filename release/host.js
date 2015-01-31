///<reference path='../definitions/ref.d.ts'/>
var ts = require('typescript');
var project = require('./project');
var fs = require('fs');
var path = require('path');
var Host = (function () {
    function Host(currentDirectory, files, externalResolve) {
        this.currentDirectory = currentDirectory;
        this.files = files;
        this.externalResolve = externalResolve;
        this.reset();
    }
    Host.initLibDefault = function () {
        var content = fs.readFileSync(path.resolve(path.dirname(require.resolve('typescript')) + '/lib.d.ts')).toString('utf8');
        this.libDefault = ts.createSourceFile('__lib.d.ts', content, 0 /* ES3 */, "0"); // Will also work for ES5 & 6
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
    Host.prototype.getCurrentDirectory = function () {
        return this.currentDirectory;
    };
    Host.prototype.getCanonicalFileName = function (filename) {
        return project.Project.normalizePath(filename);
    };
    Host.prototype.getDefaultLibFilename = function () {
        return '__lib.d.ts';
    };
    Host.prototype.writeFile = function (filename, data, writeByteOrderMark, onError) {
        this.output[filename] = data;
    };
    Host.prototype.getSourceFile = function (filename, languageVersion, onError) {
        var text;
        var normalizedFilename = project.Project.normalizePath(filename);
        if (this.files[normalizedFilename]) {
            if (this.files[normalizedFilename] === project.Project.unresolvedFile) {
                return undefined;
            }
            else {
                return this.files[normalizedFilename].ts;
            }
        }
        else if (normalizedFilename === '__lib.d.ts') {
            return Host.libDefault;
        }
        else {
            if (this.externalResolve) {
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
        var file = ts.createSourceFile(filename, text, languageVersion, "0");
        this.files[normalizedFilename] = {
            filename: normalizedFilename,
            originalFilename: filename,
            content: text,
            ts: file
        };
        return file;
    };
    Host.prototype.getFileData = function (filename) {
        return this.files[project.Project.normalizePath(filename)];
    };
    return Host;
})();
exports.Host = Host;
Host.initLibDefault();
