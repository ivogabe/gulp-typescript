var ts = require('../typescript/ts');
///<reference path='../definitions/ref.d.ts'/>
var gutil = require('gulp-util');
var path = require('path');
var fs = require('fs'); // Only used for readonly access
var sourcemapApply = require('vinyl-sourcemaps-apply');
var host = require('./host');
var Project = (function () {
    function Project(options, noExternalResolve, sortOutput) {
        /**
         * Files from the previous compilation.
         * Used to find the differences with the previous compilation, to make the new compilation faster.
         */
        this.previousFiles = {};
        /**
         * The files in the current compilation.
         * This Map only contains the files in the project, not external files. Those are in Project#additionalFiles.
         * The file property of the FileData objects in this Map are set.
         */
        this.currentFiles = {};
        /**
         * External files of the current compilation.
         * When a file is imported by or referenced from another file, and the file is not one of the input files, it
         * is added to this Map. The file property of the FileData objects in this Map are not set.
         */
        this.additionalFiles = {};
        /**
         * The version number of the compilation.
         * This number is increased for every compilation in the same gulp session.
         * Used for incremental builds.
         */
        this.version = 0;
        this.options = options;
        this.noExternalResolve = noExternalResolve;
        this.sortOutput = sortOutput;
    }
    Project.prototype.getCurrentFilenames = function () {
        var result = [];
        for (var i in this.currentFiles) {
            if (this.currentFiles.hasOwnProperty(i)) {
                result.push(this.currentFiles[i].file.path);
            }
        }
        return result;
    };
    /**
     * Resets the compiler.
     * The compiler needs to be reset for incremental builds.
     */
    Project.prototype.reset = function () {
        this.previousFiles = this.currentFiles;
        this.currentFiles = {};
        this.additionalFiles = {};
        this.version++;
    };
    /**
     * Adds a file to the project.
     */
    Project.prototype.addFile = function (file) {
        var fileData;
        var filename = Project.normalizePath(file.path);
        // Incremental compilation
        var oldFileData = this.previousFiles[filename];
        if (oldFileData) {
            if (oldFileData.content === file.contents.toString('utf8')) {
                // Unchanged, we can use the (ts) file from previous build.
                fileData = {
                    file: file,
                    filename: oldFileData.content,
                    content: oldFileData.content,
                    ts: oldFileData.ts
                };
            }
            else {
                fileData = this.getFileDataFromGulpFile(file);
            }
        }
        else {
            fileData = this.getFileDataFromGulpFile(file);
        }
        this.currentFiles[Project.normalizePath(file.path)] = fileData;
    };
    Project.prototype.getOriginalName = function (filename) {
        return filename.replace(/(\.d\.ts|\.js|\.js.map)$/, '.ts');
    };
    Project.prototype.getError = function (info) {
        var err = new Error();
        err.name = 'TypeScript error';
        if (!info.file) {
            err.message = info.code + ' ' + info.messageText;
            return err;
        }
        var filename = Project.normalizePath(this.getOriginalName(info.file.filename));
        var file = this.currentFiles[filename];
        if (file) {
            filename = path.relative(file.file.cwd, file.file.path);
        }
        else {
            filename = info.file.filename;
        }
        var startPos = info.file.getLineAndCharacterFromPosition(info.start);
        err.message = gutil.colors.red(filename + '(' + (startPos.line + 1) + ',' + (startPos.character + 1) + '): ') + info.code + ' ' + info.messageText;
        return err;
    };
    Project.prototype.resolve = function (session, file) {
        var _this = this;
        var references = file.ts.referencedFiles.map(function (item) { return Project.normalizePath(ts.combinePaths(ts.getDirectoryPath(file.ts.filename), item.filename)); });
        ts.forEachChild(file.ts, function (node) {
            if (node.kind === 174 /* ImportDeclaration */) {
                var importNode = node;
                if (importNode.externalModuleName !== undefined) {
                    var ref = Project.normalizePath(ts.combinePaths(ts.getDirectoryPath(file.ts.filename), importNode.externalModuleName.text));
                    // Don't know if this name is defined with `declare module 'foo'`, but let's load it to be sure.
                    // We guess what file the user wants. This will be right in most cases.
                    // The advantage of guessing is that we can now use fs.readFile (async) instead of fs.readFileSync.
                    // If we guessed wrong, the file will be loaded with fs.readFileSync in Host#getSourceFile (host.ts)
                    if (ref.substr(-3) === '.ts') {
                        references.push(ref);
                    }
                    else {
                        references.push(ref + '.ts');
                    }
                }
            }
        });
        for (var i = 0; i < references.length; ++i) {
            (function (i) {
                var ref = references[i];
                if (!_this.currentFiles.hasOwnProperty(ref) && !_this.additionalFiles.hasOwnProperty(ref)) {
                    session.tasks++;
                    _this.additionalFiles[ref] = Project.unresolvedFile;
                    fs.readFile(ref, function (error, data) {
                        if (data) {
                            var file = _this.getFileData(ref, data.toString('utf8'));
                            _this.additionalFiles[ref] = file;
                            _this.resolve(session, file);
                        }
                        session.tasks--;
                        if (session.tasks === 0)
                            session.callback();
                    });
                }
            })(i);
        }
    };
    Project.prototype.resolveAll = function (callback) {
        if (this.noExternalResolve) {
            callback();
            return;
        }
        var session = {
            tasks: 0,
            callback: callback
        };
        for (var i in this.currentFiles) {
            if (this.currentFiles.hasOwnProperty(i)) {
                this.resolve(session, this.currentFiles[i]);
            }
        }
        if (session.tasks === 0) {
            callback();
        }
    };
    /**
     * Compiles the input files
     */
    Project.prototype.compile = function (jsStream, declStream, errorCallback) {
        var _this = this;
        var files = {};
        for (var filename in this.currentFiles) {
            if (this.currentFiles.hasOwnProperty(filename)) {
                files[filename] = this.currentFiles[filename];
            }
        }
        for (var filename in this.additionalFiles) {
            if (this.additionalFiles.hasOwnProperty(filename)) {
                files[filename] = this.additionalFiles[filename];
            }
        }
        this.host = new host.Host(this.currentFiles[0] ? this.currentFiles[0].file.cwd : '', files, !this.noExternalResolve);
        // Creating a program compiles the sources
        this.program = ts.createProgram(this.getCurrentFilenames(), this.options, this.host);
        var errors = this.program.getDiagnostics();
        if (!errors.length) {
            // If there are no syntax errors, check types
            var checker = this.program.getTypeChecker(true);
            var semanticErrors = checker.getDiagnostics();
            var emitErrors = checker.emitFiles().errors;
            errors = semanticErrors.concat(emitErrors);
        }
        for (var i = 0; i < errors.length; i++) {
            errorCallback(this.getError(errors[i]));
        }
        var outputJS = [];
        var sourcemaps = {};
        for (var filename in this.host.output) {
            if (!this.host.output.hasOwnProperty(filename))
                continue;
            var originalName = this.getOriginalName(filename);
            var original = this.currentFiles[originalName];
            if (!original)
                continue;
            var data = this.host.output[filename];
            var fullOriginalName = original.file.path;
            if (filename.substr(-3) === '.js') {
                var file = new gutil.File({
                    path: fullOriginalName.substr(0, fullOriginalName.length - 3) + '.js',
                    contents: new Buffer(this.removeSourceMapComment(data)),
                    cwd: original.file.cwd,
                    base: original.file.base
                });
                if (original.file.sourceMap)
                    file.sourceMap = original.file.sourceMap;
                outputJS.push(file);
            }
            else if (filename.substr(-5) === '.d.ts') {
                var file = new gutil.File({
                    path: fullOriginalName.substr(0, fullOriginalName.length - 3) + '.d.ts',
                    contents: new Buffer(data),
                    cwd: original.file.cwd,
                    base: original.file.base
                });
                declStream.push(file);
            }
            else if (filename.substr(-4) === '.map') {
                sourcemaps[originalName] = data;
            }
        }
        var emit = function (originalName, file) {
            var map = sourcemaps[originalName];
            if (map)
                sourcemapApply(file, map);
            jsStream.push(file);
        };
        if (this.sortOutput) {
            var done = {};
            var sortedEmit = function (originalName, file) {
                originalName = Project.normalizePath(originalName);
                if (done[originalName])
                    return;
                done[originalName] = true;
                var inputFile = _this.currentFiles[originalName];
                var tsFile = _this.program.getSourceFile(originalName);
                var references = tsFile.referencedFiles.map(function (file) { return file.filename; });
                for (var j = 0; j < outputJS.length; ++j) {
                    var other = outputJS[j];
                    var otherName = _this.getOriginalName(other.path);
                    if (references.indexOf(otherName) !== -1) {
                        sortedEmit(otherName, other);
                    }
                }
                emit(originalName, file);
            };
            for (var i = 0; i < outputJS.length; ++i) {
                var file = outputJS[i];
                var originalName = this.getOriginalName(file.path);
                sortedEmit(originalName, file);
            }
        }
        else {
            for (var i = 0; i < outputJS.length; ++i) {
                var file = outputJS[i];
                var originalName = this.getOriginalName(file.path);
                originalName = Project.normalizePath(originalName);
                emit(originalName, file);
            }
        }
    };
    Project.prototype.getFileDataFromGulpFile = function (file) {
        var str = file.contents.toString('utf8');
        var data = this.getFileData(Project.normalizePath(file.path), str);
        data.file = file;
        return data;
    };
    Project.prototype.getFileData = function (filename, content) {
        return {
            filename: Project.normalizePath(filename),
            content: content,
            ts: ts.createSourceFile(filename, content, this.options.target, this.version + '')
        };
    };
    Project.prototype.removeSourceMapComment = function (content) {
        // By default the TypeScript automaticly inserts a source map comment.
        // This should be removed because gulp-sourcemaps takes care of that.
        // The comment is always on the last line, so it's easy to remove it
        // (But the last line also ends with a \n, so we need to look for the \n before the other)
        var index = content.lastIndexOf('\n', content.length - 2);
        return content.substring(0, index) + '\n';
    };
    Project.normalizePath = function (path) {
        return ts.normalizePath(path).toLowerCase();
    };
    Project.unresolvedFile = {
        filename: undefined,
        content: undefined,
        ts: undefined
    };
    return Project;
})();
exports.Project = Project;
