var ts = require('typescript');
var tsApi = require('./tsapi');
var output = require('./output');
var host = require('./host');
var filter = require('./filter');
/**
 * Compiles a whole project, with full type checking
 */
var ProjectCompiler = (function () {
    function ProjectCompiler() {
    }
    ProjectCompiler.prototype.prepare = function (_project) {
        this.project = _project;
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
    return ProjectCompiler;
})();
exports.ProjectCompiler = ProjectCompiler;
// TODO: file-based compiler
