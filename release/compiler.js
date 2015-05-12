var ts = require('typescript');
var path = require('path');
var tsApi = require('./tsapi');
var output = require('./output');
var host = require('./host');
var filter = require('./filter');
var utils = require('./utils');
/**
 * Compiles a whole project, with full type checking
 */
var ProjectCompiler = (function () {
    function ProjectCompiler() {
        this.hasThrownSourceDirWarning = false;
    }
    ProjectCompiler.prototype.prepare = function (_project) {
        this.project = _project;
        this.hasThrownSourceDirWarning = false;
    };
    ProjectCompiler.prototype.inputFile = function (file) { };
    ProjectCompiler.prototype.inputDone = function () {
        if (!this.project.input.firstSourceFile) {
            this.project.output.finish();
            return;
        }
        if (!this.project.input.isChanged(true)) {
            // Re-use old output
            var old = this.project.previousOutput;
            for (var _i = 0, _a = old.errors; _i < _a.length; _i++) {
                var error = _a[_i];
                this.project.output.error(error);
            }
            for (var _b = 0, _c = Object.keys(old.files); _b < _c.length; _b++) {
                var fileName = _c[_b];
                var file = old.files[fileName];
                this.project.output.write(file.fileName + '.js', file.content[output.OutputFileKind.JavaScript]);
                this.project.output.write(file.fileName + '.js.map', file.content[output.OutputFileKind.SourceMap]);
                if (file.content[output.OutputFileKind.Definitions] !== undefined) {
                    this.project.output.write(file.fileName + '.d.ts', file.content[output.OutputFileKind.Definitions]);
                }
            }
            return;
        }
        var root = this.project.input.commonBasePath;
        this.project.options.sourceRoot = root;
        this.project.options.rootDir = root; // rootDir was added in 1.5 & not available in 1.4
        this.host = new host.Host(this.project.typescript, this.project.currentDirectory, this.project.input, !this.project.noExternalResolve, this.project.options.target >= 2 /* ES6 */ ? 'lib.es6.d.ts' : 'lib.d.ts');
        var rootFilenames = this.project.input.getFileNames(true);
        if (this.project.filterSettings !== undefined) {
            var _filter = new filter.Filter(this.project, this.project.filterSettings);
            rootFilenames = rootFilenames.filter(function (fileName) { return _filter.match(fileName); });
        }
        // Creating a program to compile the sources
        this.program = this.project.typescript.createProgram(rootFilenames, this.project.options, this.host);
        var errors = tsApi.getDiagnosticsAndEmit(this.program);
        for (var i = 0; i < errors.length; i++) {
            this.project.output.diagnostic(errors[i]);
        }
        for (var fileName in this.host.output) {
            if (!this.host.output.hasOwnProperty(fileName))
                continue;
            this.project.output.write(fileName, this.host.output[fileName]);
        }
        this.project.output.finish();
    };
    Object.defineProperty(ProjectCompiler.prototype, "commonBaseDiff", {
        /**
         * Calculates the difference between the common base directory calculated based on the base paths of the input files
         * and the common source directory calculated by TypeScript.
         */
        get: function () {
            if (this._commonBaseDiff)
                return this._commonBaseDiff;
            var expected = this.project.input.commonBasePath;
            var real = this.project.input.commonSourceDirectory;
            var length = real.length - expected.length;
            if (length > 0) {
                return this._commonBaseDiff = [length, real.substring(real.length - length)];
            }
            else {
                return this._commonBaseDiff = [length, expected.substring(expected.length + length)];
            }
        },
        enumerable: true,
        configurable: true
    });
    ProjectCompiler.prototype.correctSourceMap = function (map) {
        var _this = this;
        var _a = this.commonBaseDiff, diffLength = _a[0], diff = _a[1];
        if (this.project.singleOutput)
            return true;
        if (diffLength < 0) {
            // There were files added outside of the common base.
            var outsideRoot = false;
            map.sources = map.sources.map(function (fileName) {
                var full = utils.normalizePath(path.join(_this.project.input.commonSourceDirectory, fileName));
                var relative = path.relative(utils.normalizePath(_this.project.input.commonBasePath), full);
                var first2 = relative.substring(0, 2);
                var first3 = relative.substring(0, 3);
                if (first3 === '../' || first3 === '..\\') {
                    outsideRoot = true;
                }
                else if (first2 === './' || first2 === '.\\') {
                    relative = relative.substring(2);
                }
                return full.substring(full.length - relative.length);
            });
            if (outsideRoot)
                return false;
        }
        else if (diffLength > 0 && tsApi.isTS14(this.project.typescript)) {
            if (!this.hasThrownSourceDirWarning) {
                this.hasThrownSourceDirWarning = true;
                console.error('The common source directory of the source files isn\'t equal to '
                    + 'the common base directory of the input files. That isn\'t supported '
                    + 'using the version of TypeScript currently used. Use a newer version of TypeScript instead '
                    + 'or have the common source directory point to the common base directory.');
            }
            return false;
        }
        return true;
    };
    return ProjectCompiler;
})();
exports.ProjectCompiler = ProjectCompiler;
// TODO: file-based compiler
