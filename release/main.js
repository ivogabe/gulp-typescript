///<reference path='../typings/tsd.d.ts'/>
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var ts = require('typescript');
var fs = require('fs');
var gutil = require('gulp-util');
var stream = require('stream');
var project = require('./project');
var _filter = require('./filter');
var _reporter = require('./reporter');
var compiler = require('./compiler');
var through2 = require('through2');
var PLUGIN_NAME = 'gulp-typescript';
var CompileStream = (function (_super) {
    __extends(CompileStream, _super);
    function CompileStream(proj) {
        _super.call(this, { objectMode: true });
        this.dts = new CompileOutputStream();
        this.project = proj;
        // Backwards compatibility
        this.js = this;
        // Prevent "Unhandled stream error in pipe" when compilation error occurs.
        this.on('error', function () { });
    }
    CompileStream.prototype._write = function (file, encoding, cb) {
        if (cb === void 0) { cb = function (err) { }; }
        if (!file)
            return cb();
        if (file.isNull()) {
            cb();
            return;
        }
        if (file.isStream()) {
            return cb(new gutil.PluginError(PLUGIN_NAME, 'Streaming not supported'));
        }
        var isFirstFile = this.project.input.firstSourceFile === undefined;
        var inputFile = this.project.input.addGulp(file);
        if (isFirstFile) {
            this.project.currentDirectory = this.project.input.firstSourceFile.gulp.cwd;
        }
        this.project.compiler.inputFile(inputFile);
        cb();
    };
    CompileStream.prototype._read = function () {
    };
    CompileStream.prototype.end = function (chunk, encoding, callback) {
        this._write(chunk, encoding, callback);
        this.project.compiler.inputDone();
    };
    return CompileStream;
})(stream.Duplex);
var CompileOutputStream = (function (_super) {
    __extends(CompileOutputStream, _super);
    function CompileOutputStream() {
        _super.call(this, { objectMode: true });
    }
    CompileOutputStream.prototype._read = function () {
    };
    return CompileOutputStream;
})(stream.Readable);
function compile(param, filters, theReporter) {
    var proj;
    if (param instanceof project.Project) {
        proj = param;
    }
    else {
        proj = compile.createProject(param || {});
    }
    var inputStream = new CompileStream(proj);
    proj.reset(inputStream.js, inputStream.dts);
    proj.filterSettings = filters;
    proj.reporter = theReporter || _reporter.defaultReporter();
    proj.compiler.prepare(proj);
    return inputStream;
}
var langMap = {
    'es3': 0 /* ES3 */,
    'es5': 1 /* ES5 */,
    'es6': 2 /* ES6 */
};
var moduleMap = {
    'commonjs': 1 /* CommonJS */,
    'amd': 2 /* AMD */,
    'none': 0 /* None */
};
function getCompilerOptions(settings) {
    var tsSettings = {};
    for (var key in settings) {
        if (!Object.hasOwnProperty.call(settings, key))
            continue;
        if (key === 'noExternalResolve' ||
            key === 'declarationFiles' ||
            key === 'sortOutput' ||
            key === 'typescript' ||
            key === 'target' ||
            key === 'module' ||
            key === 'sourceRoot' ||
            key === 'rootDir')
            continue;
        tsSettings[key] = settings[key];
    }
    if (typeof settings.target === 'string') {
        tsSettings.target = langMap[settings.target.toLowerCase()];
    }
    else if (typeof settings.target === 'number') {
        tsSettings.target = settings.target;
    }
    if (typeof settings.module === 'string') {
        tsSettings.module = moduleMap[settings.module.toLowerCase()];
    }
    else if (typeof settings.module === 'number') {
        tsSettings.module = settings.module;
    }
    if (tsSettings.target === undefined) {
        // TS 1.4 has a bug that the target needs to be set.
        // This block can be removed when a version that solves this bug is published.
        // The bug is already fixed in the master of TypeScript
        tsSettings.target = 0 /* ES3 */;
    }
    if (tsSettings.module === undefined) {
        // Same bug in TS 1.4 as previous comment.
        tsSettings.module = 0 /* None */;
    }
    if (settings.sourceRoot !== undefined) {
        console.warn('gulp-typescript: sourceRoot isn\'t supported any more. Use sourceRoot option of gulp-sourcemaps instead.');
    }
    if (settings.rootDir !== undefined) {
        console.warn('gulp-typescript: rootDir isn\'t supported. Use the base option of gulp.src instead.');
    }
    if (settings.declarationFiles !== undefined) {
        tsSettings.declaration = settings.declarationFiles;
    }
    tsSettings.sourceMap = true;
    return tsSettings;
}
var compile;
(function (compile) {
    compile.Project = project.Project;
    compile.reporter = _reporter;
    function createProject(fileNameOrSettings, settings) {
        var tsConfigFileName = undefined;
        var tsConfigContent = undefined;
        if (fileNameOrSettings !== undefined) {
            if (typeof fileNameOrSettings === 'string') {
                tsConfigFileName = fileNameOrSettings;
                tsConfigContent = JSON.parse(fs.readFileSync(fileNameOrSettings).toString());
                var newSettings = {};
                if (tsConfigContent.compilerOptions) {
                    for (var _i = 0, _a = Object.keys(tsConfigContent.compilerOptions); _i < _a.length; _i++) {
                        var key = _a[_i];
                        newSettings[key] = tsConfigContent.compilerOptions[key];
                    }
                }
                for (var _b = 0, _c = Object.keys(settings); _b < _c.length; _b++) {
                    var key = _c[_b];
                    newSettings[key] = settings[key];
                }
                settings = newSettings;
            }
            else {
                settings = fileNameOrSettings;
            }
        }
        var project = new compile.Project(tsConfigFileName, tsConfigContent, getCompilerOptions(settings), settings.noExternalResolve ? true : false, settings.sortOutput ? true : false, settings.typescript);
        project.compiler = new compiler.ProjectCompiler();
        return project;
    }
    compile.createProject = createProject;
    function filter(project, filters) {
        var filterObj = undefined;
        return through2.obj(function (file, encoding, callback) {
            if (!filterObj) {
                filterObj = new _filter.Filter(project, filters);
            }
            if (filterObj.match(file.path))
                this.push(file);
            callback();
        });
    }
    compile.filter = filter;
})(compile || (compile = {}));
module.exports = compile;
