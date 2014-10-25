var ts = require('../typescript/ts');
///<reference path='../definitions/ref.d.ts'/>
var project = require('./project');
var fs = require('fs');
var path = require('path');
var libDefault = fs.readFileSync(path.join(__dirname, '../typescript/lib.d.ts')).toString('utf8');
var Host = (function () {
    function Host(currentDirectory, files, externalResolve) {
        this.currentDirectory = currentDirectory;
        this.files = files;
        this.externalResolve = externalResolve;
        this.reset();
    }
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
        return filename.toLowerCase();
    };
    Host.prototype.getDefaultLibFilename = function () {
        return '__lib.d.ts';
    };
    Host.prototype.writeFile = function (filename, data, writeByteOrderMark, onError) {
        this.output[filename] = data;
    };
    Host.prototype.getSourceFile = function (filename, languageVersion, onError) {
        var text;
        filename = project.Project.normalizePath(filename);
        if (this.files[filename]) {
            if (this.files[filename] === project.Project.unresolvedFile) {
                return undefined;
            }
            else {
                return this.files[filename].ts;
            }
        }
        else if (filename === '__lib.d.ts') {
            text = libDefault;
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
        this.files[filename] = {
            filename: filename,
            content: text,
            ts: file
        };
        return file;
    };
    return Host;
})();
exports.Host = Host;
