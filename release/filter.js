var path = require('path');
var project = require('./project');
var Filter = (function () {
    function Filter(_project, filters) {
        var _this = this;
        this.referencedFrom = undefined;
        this.referencedFromAll = undefined;
        this.project = _project;
        if (filters.referencedFrom !== undefined) {
            this.referencedFrom = this.mapFilenamesToFiles(filters.referencedFrom);
            this.referencedFromAll = [];
            var addReference = function (file) {
                if (_this.referencedFromAll.indexOf(file.filename) !== -1)
                    return;
                _this.referencedFromAll.push(file.filename);
                for (var i = 0; i < file.ts.referencedFiles.length; i++) {
                    var ref = file.ts.referencedFiles[i].filename;
                    ref = project.Project.normalizePath(path.join(path.dirname(file.ts.filename), ref));
                    var refFile = _this.project.currentFiles[ref];
                    if (refFile)
                        addReference(refFile);
                }
            };
            for (var i = 0; i < this.referencedFrom.length; i++) {
                addReference(this.referencedFrom[i]);
            }
        }
    }
    Filter.prototype.mapFilenamesToFiles = function (filenames) {
        var files = [];
        for (var i = 0; i < filenames.length; i++) {
            var file = this.getFile(filenames[i]);
            if (file === undefined) {
                console.log('gulp-typescript: Could not find file ' + filenames[i]);
            }
            else {
                files.push(file);
            }
        }
        return files;
    };
    Filter.prototype.getFile = function (filename) {
        var files = this.project.currentFiles;
        for (var i in files) {
            if (!files.hasOwnProperty(i))
                continue;
            if (files[i].file.path.substring(files[i].file.base.length) == filename) {
                return files[i];
            }
        }
        return undefined;
    };
    Filter.prototype.match = function (filename) {
        var originalFilename = project.Project.normalizePath(filename);
        originalFilename = this.project.getOriginalName(originalFilename);
        var file = this.project.currentFiles[originalFilename];
        if (!file) {
            console.log('gulp-typescript: Could not find file ' + filename + '. Make sure you don\'t rename a file before you pass it to ts.filter()');
        }
        if (this.referencedFrom !== undefined) {
            if (!this.matchReferencedFrom(filename, originalFilename, file)) {
                return false;
            }
        }
        return true;
    };
    Filter.prototype.matchReferencedFrom = function (filename, originalFilename, file) {
        return this.referencedFromAll.indexOf(originalFilename) !== -1;
    };
    return Filter;
})();
exports.Filter = Filter;
