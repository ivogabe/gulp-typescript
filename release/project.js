///<reference path='../definitions/ref.d.ts'/>
var ts = require('typescript');
var tsApi = require('./tsapi');
var gutil = require('gulp-util');
var sourceMap = require('source-map');
var path = require('path');
var fs = require('fs'); // Only used for readonly access
var host = require('./host');
var filter = require('./filter');
var Project = (function () {
    function Project(options, noExternalResolve, sortOutput, typescript) {
        if (typescript === void 0) { typescript = ts; }
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
         *
         */
        this.firstFile = undefined;
        this.isFileChanged = false;
        /**
         * The version number of the compilation.
         * This number is increased for every compilation in the same gulp session.
         * Used for incremental builds.
         */
        this.version = 0;
        this.typescript = typescript;
        this.options = options;
        this.noExternalResolve = noExternalResolve;
        this.sortOutput = sortOutput;
    }
    /**
     * Resets the compiler.
     * The compiler needs to be reset for incremental builds.
     */
    Project.prototype.reset = function () {
        this.previousFiles = this.currentFiles;
        this.firstFile = undefined;
        this.isFileChanged = false;
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
                    filename: oldFileData.filename,
                    originalFilename: file.path,
                    content: oldFileData.content,
                    ts: oldFileData.ts
                };
            }
            else {
                fileData = this.getFileDataFromGulpFile(file);
                this.isFileChanged = true;
            }
        }
        else {
            fileData = this.getFileDataFromGulpFile(file);
            this.isFileChanged = true;
        }
        if (!this.firstFile)
            this.firstFile = fileData;
        this.currentFiles[Project.normalizePath(file.path)] = fileData;
    };
    Project.prototype.getOriginalName = function (filename) {
        return filename.replace(/(\.d\.ts|\.js|\.js.map)$/, '.ts');
    };
    Project.prototype.getError = function (info) {
        var err = new Error();
        err.name = 'TypeScript error';
        err.diagnostic = info;
        if (!info.file) {
            err.message = info.code + ' ' + tsApi.flattenDiagnosticMessageText(this.typescript, info.messageText);
            return err;
        }
        var filename = this.getOriginalName(tsApi.getFileName(info.file));
        var file = this.host.getFileData(filename);
        if (file) {
            err.tsFile = file.ts;
            err.fullFilename = file.originalFilename;
            if (file.file) {
                filename = path.relative(file.file.cwd, file.originalFilename);
                err.relativeFilename = filename;
                err.file = file.file;
            }
            else {
                filename = file.originalFilename;
            }
        }
        else {
            filename = tsApi.getFileName(info.file);
            err.fullFilename = filename;
        }
        var startPos = tsApi.getLineAndCharacterOfPosition(this.typescript, info.file, info.start);
        var endPos = tsApi.getLineAndCharacterOfPosition(this.typescript, info.file, info.start + info.length);
        err.startPosition = {
            position: info.start,
            line: startPos.line,
            character: startPos.character
        };
        err.endPosition = {
            position: info.start + info.length - 1,
            line: endPos.line,
            character: endPos.character
        };
        err.message = gutil.colors.red(filename + '(' + startPos.line + ',' + startPos.character + '): ')
            + info.code + ' '
            + tsApi.flattenDiagnosticMessageText(this.typescript, info.messageText);
        return err;
    };
    Project.prototype.lazyCompile = function (jsStream, declStream) {
        if (this.isFileChanged === false
            && Object.keys(this.currentFiles).length === Object.keys(this.previousFiles).length
            && this.previousOutputJS !== undefined
            && this.previousOutputDts !== undefined) {
            // Emit files from previous build, since they are the same.
            // JavaScript files
            for (var i = 0; i < this.previousOutputJS.length; i++) {
                var file = this.previousOutputJS[i];
                var originalName = this.getOriginalName(Project.normalizePath(file.filename));
                var original = this.currentFiles[originalName];
                if (!original)
                    continue;
                var gFile = new gutil.File({
                    path: original.originalFilename.substr(0, original.originalFilename.length - 3) + '.js',
                    contents: new Buffer(file.content),
                    cwd: original.file.cwd,
                    base: original.file.base
                });
                gFile.sourceMap = file.sourcemap;
                jsStream.push(gFile);
            }
            // Definitions files
            for (var i = 0; i < this.previousOutputDts.length; i++) {
                var file = this.previousOutputDts[i];
                var originalName = this.getOriginalName(Project.normalizePath(file.filename));
                var original = this.currentFiles[originalName];
                if (!original)
                    continue;
                declStream.push(new gutil.File({
                    path: original.originalFilename.substr(0, original.originalFilename.length - 3) + '.d.ts',
                    contents: new Buffer(file.content),
                    cwd: original.file.cwd,
                    base: original.file.base
                }));
            }
            return true;
        }
        return false;
    };
    Project.prototype.resolve = function (session, file) {
        var _this = this;
        var references = file.ts.referencedFiles.map(function (item) { return path.join(path.dirname(tsApi.getFileName(file.ts)), tsApi.getFileName(item)); });
        for (var i = 0; i < references.length; ++i) {
            (function (i) {
                var ref = references[i];
                var normalizedRef = Project.normalizePath(ref);
                if (!_this.currentFiles.hasOwnProperty(normalizedRef) && !_this.additionalFiles.hasOwnProperty(normalizedRef)) {
                    session.tasks++;
                    _this.additionalFiles[normalizedRef] = Project.unresolvedFile;
                    fs.readFile(ref, function (error, data) {
                        if (data) {
                            var file = _this.getFileData(ref, data.toString('utf8'));
                            _this.additionalFiles[normalizedRef] = file;
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
        var _filter;
        if (this.filterSettings !== undefined) {
            _filter = new filter.Filter(this, this.filterSettings);
        }
        var rootFilenames = [];
        for (var filename in this.currentFiles) {
            if (this.currentFiles.hasOwnProperty(filename)) {
                if (!_filter || _filter.match(filename)) {
                    files[filename] = this.currentFiles[filename];
                    rootFilenames.push(files[filename].originalFilename);
                }
            }
        }
        for (var filename in this.additionalFiles) {
            if (this.additionalFiles.hasOwnProperty(filename)) {
                files[filename] = this.additionalFiles[filename];
            }
        }
        this.host = new host.Host(this.typescript, this.currentFiles[0] ? this.currentFiles[0].file.cwd : '', files, !this.noExternalResolve);
        // Creating a program compiles the sources
        this.program = this.typescript.createProgram(rootFilenames, this.options, this.host);
        var errors = tsApi.getDiagnosticsAndEmit(this.program);
        for (var i = 0; i < errors.length; i++) {
            errorCallback(this.getError(errors[i]));
        }
        var outputJS = [];
        var sourcemaps = {};
        if (errors.length) {
            this.previousOutputJS = undefined;
            this.previousOutputDts = undefined;
        }
        else {
            this.previousOutputJS = [];
            this.previousOutputDts = [];
        }
        for (var filename in this.host.output) {
            if (!this.host.output.hasOwnProperty(filename))
                continue;
            var originalName = this.getOriginalName(Project.normalizePath(filename));
            var original;
            if (this.options.out !== undefined) {
                original = this.firstFile;
                if (!original)
                    continue;
                var fullOriginalName = path.join(original.file.base, this.options.out);
            }
            else {
                original = this.currentFiles[originalName];
                if (!original)
                    continue;
                var fullOriginalName = original.originalFilename;
            }
            var lastDot = fullOriginalName.lastIndexOf('.');
            if (lastDot === -1)
                lastDot = fullOriginalName.length;
            var fullOriginalNameWithoutExtension = fullOriginalName.substring(0, lastDot);
            var data = this.host.output[filename];
            if (filename.substr(-3) === '.js') {
                var file = new gutil.File({
                    path: fullOriginalNameWithoutExtension + '.js',
                    contents: new Buffer(this.removeSourceMapComment(data)),
                    cwd: original.file.cwd,
                    base: original.file.base
                });
                outputJS.push(file);
            }
            else if (filename.substr(-5) === '.d.ts') {
                var file = new gutil.File({
                    path: fullOriginalNameWithoutExtension + '.d.ts',
                    contents: new Buffer(data),
                    cwd: original.file.cwd,
                    base: original.file.base
                });
                if (this.previousOutputDts !== undefined) {
                    this.previousOutputDts.push({
                        filename: file.path,
                        content: data
                    });
                }
                declStream.push(file);
            }
            else if (filename.substr(-4) === '.map') {
                if (this.options.out !== undefined) {
                    sourcemaps[''] = data;
                }
                else {
                    sourcemaps[originalName] = data;
                }
            }
        }
        var emit = function (originalName, file) {
            var map = sourcemaps[_this.options.out !== undefined ? '' : originalName];
            if (map) {
                var parsedMap = JSON.parse(map);
                parsedMap.file = parsedMap.file.replace(/\\/g, '/');
                parsedMap.sources = parsedMap.sources.map(function (filePath) {
                    return filePath.replace(/\\/g, '/');
                });
                var oldFiles;
                if (_this.options.out !== undefined) {
                    oldFiles = Object.keys(_this.currentFiles);
                }
                else {
                    oldFiles = [originalName];
                }
                var generator = sourceMap.SourceMapGenerator.fromSourceMap(new sourceMap.SourceMapConsumer(parsedMap));
                for (var i = 0; i < oldFiles.length; i++) {
                    var oldFile = _this.currentFiles[oldFiles[i]];
                    if (!oldFile || !oldFile.file || !oldFile.file.sourceMap)
                        continue;
                    generator.applySourceMap(new sourceMap.SourceMapConsumer(oldFile.file.sourceMap));
                }
                file.sourceMap = JSON.parse(generator.toString());
            }
            else
                console.log(originalName, sourcemaps);
            if (_this.previousOutputJS !== undefined) {
                _this.previousOutputJS.push({
                    filename: file.path,
                    content: file.contents.toString(),
                    sourcemap: file.sourceMap
                });
            }
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
                var references = tsFile.referencedFiles.map(function (file) { return tsApi.getFileName(file); });
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
        var data = this.getFileData(file.path, str);
        data.file = file;
        return data;
    };
    Project.prototype.getFileData = function (filename, content) {
        return {
            filename: Project.normalizePath(filename),
            originalFilename: filename,
            content: content,
            ts: tsApi.createSourceFile(this.typescript, filename, content, this.options.target, this.version + '')
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
    Project.normalizePath = function (pathString) {
        return path.normalize(pathString).toLowerCase();
    };
    Project.unresolvedFile = {
        filename: undefined,
        originalFilename: undefined,
        content: undefined,
        ts: undefined
    };
    return Project;
})();
exports.Project = Project;
