var ts = require('../typescript/ts');
///<reference path='../definitions/ref.d.ts'/>
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var gutil = require('gulp-util');
var stream = require('stream');
var project = require('./project');
var PLUGIN_NAME = 'gulp-typescript';
var CompileStream = (function (_super) {
    __extends(CompileStream, _super);
    function CompileStream(proj) {
        _super.call(this, { objectMode: true });
        this.dts = new CompileOutputStream();
        this._project = proj;
        // Backwards compatibility
        this.js = this;
        // Prevent "Unhandled stream error in pipe" when compilation error occurs.
        this.on('error', function () {
        });
    }
    CompileStream.prototype._write = function (file, encoding, cb) {
        if (cb === void 0) { cb = function (err) {
        }; }
        if (!file)
            return cb();
        if (file.isNull()) {
            cb();
            return;
        }
        if (file.isStream()) {
            return cb(new gutil.PluginError(PLUGIN_NAME, 'Streaming not supported'));
        }
        this._project.addFile(file);
        cb();
    };
    CompileStream.prototype._read = function () {
    };
    CompileStream.prototype.compile = function () {
        var _this = this;
        this._project.resolveAll(function () {
            _this._project.compile(_this.js, _this.dts, function (err) {
                console.error(err.message);
                _this.emit('error', new gutil.PluginError(PLUGIN_NAME, err.message));
            });
            _this.js.push(null);
            _this.dts.push(null);
        });
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
function compile(param) {
    var proj;
    if (param instanceof project.Project) {
        proj = param;
    }
    else {
        proj = new project.Project(getCompilerOptions(param || {}), (param && param.noExternalResolve) || false, (param && param.sortOutput) || false);
    }
    proj.reset();
    var inputStream = new CompileStream(proj);
    return inputStream;
}
var langMap = {
    'es3': 0 /* ES3 */,
    'es5': 1 /* ES5 */
};
var moduleMap = {
    'commonjs': 1 /* CommonJS */,
    'amd': 2 /* AMD */
};
function getCompilerOptions(settings) {
    var tsSettings = {};
    if (settings.removeComments !== undefined) {
        tsSettings.removeComments = settings.removeComments;
    }
    if (settings.noImplicitAny !== undefined) {
        tsSettings.noImplicitAny = settings.noImplicitAny;
    }
    if (settings.noLib !== undefined) {
        tsSettings.noLib = settings.noLib;
    }
    if (settings.target !== undefined) {
        tsSettings.target = langMap[(settings.target || 'es3').toLowerCase()];
    }
    if (settings.module !== undefined) {
        tsSettings.module = moduleMap[(settings.module || 'none').toLowerCase()];
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
    function createProject(settings) {
        return new compile.Project(getCompilerOptions(settings), settings.noExternalResolve ? true : false, settings.sortOutput ? true : false);
    }
    compile.createProject = createProject;
})(compile || (compile = {}));
module.exports = compile;
