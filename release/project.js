///<reference path='../definitions/ref.d.ts'/>
var typescript = require('typescript-api');
var gutil = require('gulp-util');
var path = require('path');

var fs = require('fs');
var sourcemapApply = require('vinyl-sourcemaps-apply');

var defaultLibSnapshot = typescript.ScriptSnapshot.fromString(fs.readFileSync(path.join(__dirname, '../lib.d.ts')).toString('utf8'));

var Project = (function () {
    function Project(settings, noExternalResolve, sortOutput) {
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
        * A complete list of all the files in the current compilation.
        * The list can contain duplicates, but that doesn't matter for the code below.
        */
        this.references = [];
        /**
        * Whether there was a 'no-default-lib' tag found in one of the files in the current compilation.
        */
        this.hasNoDefaultLibTag = false;
        /**
        * Whether the default lib.d.ts was added to the compiler. Used by Project#setDefaultLib.
        */
        this.defaultLibInCompiler = false;
        /**
        * The version number of the compilation.
        * This number is increased for every compilation in the same gulp session.
        * Used for incremental builds.
        */
        this.version = 0;
        this.compiler = new typescript.TypeScriptCompiler(new typescript.NullLogger(), settings);

        if (!settings.noLib()) {
            this.setDefaultLib(true);
        }

        this.noExternalResolve = noExternalResolve;
        this.sortOutput = sortOutput;
    }
    /**
    * Adds or removes lib.d.ts
    */
    Project.prototype.setDefaultLib = function (active) {
        if (active != this.defaultLibInCompiler) {
            if (active) {
                // Add defaultLib
                this.compiler.addFile('lib.d.ts', defaultLibSnapshot, 1 /* Utf8 */, this.version, false, []);
            } else {
                // Remove lib.d.ts
                this.compiler.removeFile('lib.d.ts');
            }

            this.defaultLibInCompiler = active;
        }
    };

    /**
    * Resets the compiler.
    * The compiler needs to be reset for incremental builds.
    */
    Project.prototype.reset = function () {
        this.previousFiles = this.currentFiles;
        this.currentFiles = {};
        this.references = [];

        for (var filename in this.additionalFiles) {
            if (!Object.prototype.hasOwnProperty.call(this.additionalFiles, filename)) {
                continue;
            }
            this.compiler.removeFile(filename);
        }

        this.additionalFiles = {};
        this.version++;
        this.hasNoDefaultLibTag = false;
    };

    /**
    * Adds a file to the project.
    */
    Project.prototype.addFile = function (file) {
        this.currentFiles[this.normalizePath(file.path)] = this.getFileDataFromGulpFile(file);
    };

    Project.prototype.getOriginalName = function (filename) {
        return filename.replace(/(\.d\.ts|\.js|\.js.map)$/, '.ts');
    };
    Project.prototype.getError = function (info) {
        var filename = this.getOriginalName(info.fileName());
        var file = this.currentFiles[filename];

        if (file) {
            filename = path.relative(file.file.cwd, info.fileName());
        } else {
            filename = info.fileName();
        }

        var err = new Error();
        err.name = 'TypeScript error';
        err.message = gutil.colors.red(filename + '(' + info.line() + ',' + info.character() + '): ') + info.message();

        return err;
    };

    /**
    * Compiles the input files
    */
    Project.prototype.compile = function (jsStream, declStream, errorCallback) {
        var _this = this;
        for (var filename in this.previousFiles) {
            if (!Object.prototype.hasOwnProperty.call(this.previousFiles, filename)) {
                continue;
            }

            if (!this.currentFiles[filename]) {
                this.compiler.removeFile(filename);
            }
        }

        for (var filename in this.currentFiles) {
            if (!Object.prototype.hasOwnProperty.call(this.currentFiles, filename)) {
                continue;
            }

            var fileData = this.currentFiles[filename];
            fileData.addedToCompiler = true;
            if (this.previousFiles[filename]) {
                // Update
                var range = this.getTextChangeRange(this.previousFiles[filename].content, fileData.content);
                if (range != typescript.TextChangeRange.unchanged) {
                    this.compiler.updateFile(filename, fileData.scriptSnapshot, this.version, false, range);
                }
            } else {
                // Add
                this.compiler.addFile(filename, fileData.scriptSnapshot, fileData.byteOrderMark, this.version, false, []);
            }
        }

        // Look for external files (imports and references to files outside the input files)
        if (!this.noExternalResolve || this.sortOutput) {
            for (var filename in this.currentFiles) {
                if (!Object.prototype.hasOwnProperty.call(this.currentFiles, filename)) {
                    continue;
                }

                if (this.references.indexOf(filename) != -1 && !this.sortOutput) {
                    continue;
                }

                var references = typescript.ReferenceResolver.resolve([filename], this, false);

                var referenceStrings = references.resolvedFiles.map(function (ref) {
                    return _this.normalizePath(ref.path);
                });

                this.currentFiles[filename].referencedFiles = referenceStrings;

                this.references = this.references.concat(referenceStrings);

                this.hasNoDefaultLibTag = this.hasNoDefaultLibTag || references.seenNoDefaultLibTag;
            }
        }

        if (!this.noExternalResolve) {
            this.setDefaultLib(!this.hasNoDefaultLibTag);
            this.handleReferences(this.references);
        }

        var results = this.compiler.compile(function (path) {
            return typescript.IO.resolvePath(path);
        });

        var outputJS = [];
        var sourcemaps = {};

        while (results.moveNext()) {
            var res = results.current();

            res.diagnostics.forEach(function (item) {
                errorCallback(_this.getError(item));
            });

            res.outputFiles.forEach(function (outputFile) {
                var originalName = _this.getOriginalName(outputFile.name);
                var original = _this.currentFiles[originalName];

                if (!original)
                    return;

                if (outputFile.fileType === 1 /* SourceMap */) {
                    sourcemaps[originalName] = outputFile.text;
                }

                switch (outputFile.fileType) {
                    case 0 /* JavaScript */:
                        var file = new gutil.File({
                            path: outputFile.name,
                            contents: new Buffer(_this.removeSourceMapComment(outputFile.text)),
                            cwd: original.file.cwd,
                            base: original.file.base
                        });

                        if (original.file.sourceMap)
                            file.sourceMap = original.file.sourceMap;
                        outputJS.push(file);
                        break;
                    case 2 /* Declaration */:
                        var file = new gutil.File({
                            path: outputFile.name,
                            contents: new Buffer(outputFile.text),
                            cwd: original.file.cwd,
                            base: original.file.base
                        });

                        declStream.push(file);
                        break;
                }
            });
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
                if (done[originalName])
                    return;
                done[originalName] = true;

                var inputFile = _this.currentFiles[originalName];

                for (var j = 0; j < outputJS.length; ++j) {
                    var other = outputJS[j];
                    var otherName = _this.getOriginalName(other.path);

                    if (inputFile.referencedFiles.indexOf(otherName) !== -1) {
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
        } else {
            for (var i = 0; i < outputJS.length; ++i) {
                var file = outputJS[i];
                var originalName = this.getOriginalName(file.path);
                emit(originalName, file);
            }
        }
    };

    Project.prototype.handleReferences = function (references) {
        var _this = this;
        references.forEach(function (filename) {
            filename = _this.normalizePath(filename);
            if (!(_this.currentFiles[filename] || _this.additionalFiles[filename].addedToCompiler)) {
                var data = _this.additionalFiles[filename];

                _this.compiler.addFile(filename, data.scriptSnapshot, data.byteOrderMark, _this.version, false, []);

                data.addedToCompiler = true;
            }
        });
    };

    Project.prototype.getFileDataFromGulpFile = function (file) {
        var str = file.contents.toString('utf8');

        var data = this.getFileData(this.normalizePath(file.path), str);
        data.file = file;

        return data;
    };

    Project.prototype.getFileData = function (filename, content) {
        return {
            content: content,
            scriptSnapshot: typescript.ScriptSnapshot.fromString(content),
            byteOrderMark: 1 /* Utf8 */,
            referencedFiles: [],
            addedToCompiler: false
        };
    };

    Project.prototype.getTextChangeRange = function (oldStr, newStr) {
        var begin = 0;
        var end = 0;

        var max = newStr.length > oldStr.length ? newStr : oldStr;
        var min = newStr.length > oldStr.length ? oldStr : newStr;

        if (min == max)
            return typescript.TextChangeRange.unchanged;

        for (var i = 0; i < min.length; ++i) {
            if (min.charAt(i) == max.charAt(i)) {
                begin = i + 1;
            } else {
                break;
            }
        }

        for (var i = 0; i + begin < min.length; ++i) {
            if (min.charAt(min.length - 1 - i) == max.charAt(max.length - 1 - i)) {
                end = i + 1;
            } else {
                break;
            }
        }

        return new typescript.TextChangeRange(new typescript.TextSpan(begin, oldStr.length - begin - end), newStr.length - begin - end);
    };

    Project.prototype.removeSourceMapComment = function (content) {
        // By default the TypeScript automaticly inserts a source map comment.
        // This should be removed because gulp-sourcemaps takes care of that.
        // The comment is always on the last line, so it's easy to remove it
        // (But the last line also ends with a \n, so we need to look for the \n before the other)
        var index = content.lastIndexOf('\n', content.length - 2);
        return content.substring(0, index) + '\n';
    };

    Project.prototype.normalizePath = function (path) {
        path = this.resolvePath(path);

        // Switch to forward slashes
        path = typescript.switchToForwardSlashes(path);

        return path;
    };

    // IReferenceResolverHost
    Project.prototype.getScriptSnapshot = function (filename) {
        filename = this.normalizePath(filename);
        if (this.currentFiles[filename]) {
            return this.currentFiles[filename].scriptSnapshot;
        } else if (this.additionalFiles[filename]) {
            return this.additionalFiles[filename].scriptSnapshot;
        } else if (!this.noExternalResolve) {
            var data = fs.readFileSync(filename).toString('utf8');
            this.additionalFiles[filename] = this.getFileData(filename, data);
            return this.additionalFiles[filename].scriptSnapshot;
        }
    };
    Project.prototype.resolveRelativePath = function (path, directory) {
        var unQuotedPath = typescript.stripStartAndEndQuotes(path);
        var normalizedPath;

        if (typescript.isRooted(unQuotedPath) || !directory) {
            normalizedPath = unQuotedPath;
        } else {
            normalizedPath = typescript.IOUtils.combine(directory, unQuotedPath);
        }

        // get the absolute path
        normalizedPath = this.resolvePath(normalizedPath);

        // Switch to forward slashes
        normalizedPath = typescript.switchToForwardSlashes(normalizedPath);

        return normalizedPath;
    };
    Project.prototype.fileExists = function (path) {
        if (this.currentFiles[path] || this.additionalFiles[path]) {
            return true;
        } else if (!this.noExternalResolve) {
            return typescript.IO.fileExists(path);
        } else {
            return false;
        }
    };
    Project.prototype.getParentDirectory = function (path) {
        return typescript.IO.dirName(path);
    };
    Project.prototype.directoryExists = function (path) {
        var newPath = path;
        if (newPath.substr(newPath.length - 1) != '/') {
            newPath += '/';
        }

        for (var filename in this.currentFiles) {
            if (!Object.prototype.hasOwnProperty.call(this.currentFiles, filename)) {
                continue;
            }

            if (filename.length > newPath.length) {
                if (filename.substring(0, newPath.length) == newPath) {
                    return true;
                }
            }
        }
        for (var filename in this.additionalFiles) {
            if (!Object.prototype.hasOwnProperty.call(this.additionalFiles, filename)) {
                continue;
            }

            if (filename.length > newPath.length) {
                if (filename.substring(0, newPath.length) == newPath) {
                    return true;
                }
            }
        }

        if (this.noExternalResolve) {
            return false;
        } else {
            return typescript.IO.directoryExists(path);
        }
    };
    Project.prototype.resolvePath = function (path) {
        return typescript.IO.resolvePath(path);
    };
    return Project;
})();
exports.Project = Project;
