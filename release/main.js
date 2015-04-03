///<reference path='../definitions/ref.d.ts'/>
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var ts = require('typescript');
var gutil = require('gulp-util');
var stream = require('stream');
var project = require('./project');
var _filter = require('./filter');
var _reporter = require('./reporter');
var through2 = require('through2');
var PLUGIN_NAME = 'gulp-typescript';
var CompileStream = (function (_super) {
    __extends(CompileStream, _super);
    function CompileStream(proj, theReporter) {
        if (theReporter === void 0) { theReporter = _reporter.defaultReporter(); }
        _super.call(this, { objectMode: true });
        this._hasSources = false;
        this.dts = new CompileOutputStream();
        this._project = proj;
        this.reporter = theReporter;
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
        this._hasSources = true;
        this._project.addFile(file);
        cb();
    };
    CompileStream.prototype._read = function () {
    };
    CompileStream.prototype.compile = function () {
        var _this = this;
        if (!this._hasSources) {
            this.js.push(null);
            this.dts.push(null);
            return;
        }
        // Try to re-use the output of the previous build. If that fails, start normal compilation.
        if (this._project.lazyCompile(this.js, this.dts)) {
            this.js.push(null);
            this.dts.push(null);
        }
        else {
            this._project.resolveAll(function () {
                _this._project.compile(_this.js, _this.dts, function (err) {
                    if (_this.reporter.error)
                        _this.reporter.error(err, _this._project.typescript);
                    _this.emit('error', new gutil.PluginError(PLUGIN_NAME, err.message));
                });
                _this.js.push(null);
                _this.dts.push(null);
            });
        }
    };
    CompileStream.prototype.end = function (chunk, encoding, callback) {
        this._write(chunk, encoding, callback);
        this.compile();
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
        proj = new project.Project(getCompilerOptions(param || {}), (param && param.noExternalResolve) || false, (param && param.sortOutput) || false, (param && param.typescript) || undefined);
    }
    proj.reset();
    proj.filterSettings = filters;
    var inputStream = new CompileStream(proj, theReporter);
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
        if (key === 'outDir' ||
            key === 'noExternalResolve' ||
            key === 'declarationFiles' ||
            key === 'sortOutput' ||
            key === 'typescript' ||
            key === 'target' ||
            key === 'module' ||
            key === 'sourceRoot')
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
    if (settings.sourceRoot === undefined) {
        tsSettings.sourceRoot = process.cwd();
    }
    else {
        tsSettings.sourceRoot = settings.sourceRoot;
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
    function createProject(settings) {
        return new compile.Project(getCompilerOptions(settings), settings.noExternalResolve ? true : false, settings.sortOutput ? true : false, settings.typescript);
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
