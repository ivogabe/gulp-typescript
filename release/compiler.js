var tsApi = require('./tsApi');
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
        this.host = new host.Host(this.project.typescript, this.project.currentDirectory, this.project.input, !this.project.noExternalResolve);
        var rootFilenames = this.project.input.getFileNames(true);
        if (this.project.filterSettings !== undefined) {
            var _filter = new filter.Filter(this.project, this.project.filterSettings);
            rootFilenames = rootFilenames.filter(function (fileName) { return _filter.match(fileName); });
        }
        // Creating a program to compile the sources
        this.program = this.project.typescript.createProgram(rootFilenames, this.project.options, this.host);
        var errors = tsApi.getDiagnosticsAndEmit(this.program);
        for (var i = 0; i < errors.length; i++) {
            this.project.output.error(errors[i]);
        }
        var outputJS = [];
        var sourcemaps = {};
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
