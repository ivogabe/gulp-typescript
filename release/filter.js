var tsApi = require('./tsapi');
var path = require('path');
var utils = require('./utils');
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
                if (_this.referencedFromAll.indexOf(file.fileNameNormalized) !== -1)
                    return;
                _this.referencedFromAll.push(file.fileNameNormalized);
                for (var i = 0; i < file.ts.referencedFiles.length; i++) {
                    var ref = tsApi.getFileName(file.ts.referencedFiles[i]);
                    ref = utils.normalizePath(path.join(path.dirname(tsApi.getFileName(file.ts)), ref));
                    var refFile = _this.project.files.getFile(ref);
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
        var fileNames = this.project.files.getFileNames(true);
        for (var _i = 0; _i < fileNames.length; _i++) {
            var fileName = fileNames[_i];
            var _file = this.project.files.getFile(fileName);
            if (!_file)
                console.log(fileName);
            if (_file.gulp && _file.gulp.path.substring(_file.gulp.base.length) === filename) {
                return _file;
            }
        }
        return undefined;
    };
    Filter.prototype.match = function (filename) {
        var originalFilename = utils.normalizePath(filename);
        originalFilename = this.project.getOriginalName(originalFilename);
        var file = this.project.files.getFile(originalFilename);
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
    Filter.prototype.matchReferencedFrom = function (filename, originalFilename, _file) {
        return this.referencedFromAll.indexOf(originalFilename) !== -1;
    };
    return Filter;
})();
exports.Filter = Filter;
