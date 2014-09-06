///<reference path='../definitions/ref.d.ts'/>
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var typescript = require('typescript-api');
var gutil = require('gulp-util');

var stream = require('stream');
var project = require('./project');

var PLUGIN_NAME = 'gulp-typescript-compiler';

var CompileStream = (function (_super) {
    __extends(CompileStream, _super);
    function CompileStream(proj) {
        _super.call(this, { objectMode: true });
        this.js = new CompileOutputStream();
        this.dts = new CompileOutputStream();

        this._project = proj;

        // Prevent "Unhandled stream error in pipe" when compilation error occurs.
        this.on('error', function () {
        });
    }
    CompileStream.prototype._write = function (file, encoding, cb) {
        if (typeof cb === "undefined") { cb = function (err) {
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

    CompileStream.prototype.compile = function () {
        var _this = this;
        this._project.compile(this.js, this.dts, function (err) {
            console.error(err.message);
            _this.emit('error', new gutil.PluginError(PLUGIN_NAME, err.message));
        });
        this.js.push(null);
        this.dts.push(null);
    };

    CompileStream.prototype.end = function (chunk, encoding, callback) {
        this._write(chunk, encoding, callback);
        this.compile();
    };
    return CompileStream;
})(stream.Writable);
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
    } else {
        proj = new project.Project(getImmutableCompilationSettings(param || {}), (param && param.noExternalResolve) || false, (param && param.sortOutput) || false);
    }

    proj.reset();

    var inputStream = new CompileStream(proj);

    return inputStream;
}

var langMap = {
    'es3': 0 /* EcmaScript3 */,
    'es5': 1 /* EcmaScript5 */
};
var moduleMap = {
    'commonjs': 1 /* Synchronous */,
    'amd': 2 /* Asynchronous */
};

function getImmutableCompilationSettings(settings) {
    var tsSettings = new typescript.CompilationSettings();

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
        tsSettings.codeGenTarget = langMap[(settings.target || 'es3').toLowerCase()];
    }
    if (settings.module !== undefined) {
        tsSettings.moduleGenTarget = moduleMap[(settings.module || 'none').toLowerCase()];
    }

    if (settings.sourceRoot === undefined) {
        tsSettings.sourceRoot = process.cwd();
    } else {
        tsSettings.sourceRoot = settings.sourceRoot;
    }

    if (settings.declarationFiles !== undefined) {
        tsSettings.generateDeclarationFiles = settings.declarationFiles;
    }

    tsSettings.useCaseSensitiveFileResolution = false;
    tsSettings.mapSourceFiles = true;

    return typescript.ImmutableCompilationSettings.fromCompilationSettings(tsSettings);
}

var compile;
(function (compile) {
    var Project = project.Project;
    compile.Project = Project;
    function createProject(settings) {
        return new Project(getImmutableCompilationSettings(settings), settings.noExternalResolve ? true : false, settings.sortOutput ? true : false);
    }
    compile.createProject = createProject;
})(compile || (compile = {}));

module.exports = compile;
