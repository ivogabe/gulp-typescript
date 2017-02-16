"use strict";
var path = require('path');
var input_1 = require('./input');
var host_1 = require('./host');
var reporter_1 = require('./reporter');
var utils = require('./utils');
/**
 * Compiles a whole project, with full type checking
 */
var ProjectCompiler = (function () {
    function ProjectCompiler() {
    }
    ProjectCompiler.prototype.prepare = function (project) {
        this.project = project;
        this.hasSourceMap = false;
    };
    ProjectCompiler.prototype.inputFile = function (file) {
        if (file.gulp.sourceMap)
            this.hasSourceMap = true;
    };
    ProjectCompiler.prototype.inputDone = function () {
        var _this = this;
        if (!this.project.input.firstSourceFile) {
            this.project.output.finish(reporter_1.emptyCompilationResult());
            return;
        }
        var rootFilenames = this.project.input.getFileNames(true);
        if (!this.project.singleOutput) {
            if (this.project.options.rootDir === undefined) {
                this.project.options.rootDir = utils.getCommonBasePathOfArray(rootFilenames.filter(function (fileName) { return fileName.substr(-5) !== ".d.ts"; })
                    .map(function (fileName) { return _this.project.input.getFile(fileName).gulp.base; }));
            }
        }
        this.project.options.sourceMap = this.hasSourceMap;
        var currentDirectory = utils.getCommonBasePathOfArray(rootFilenames.map(function (fileName) { return _this.project.input.getFile(fileName).gulp.cwd; }));
        this.host = new host_1.Host(this.project.typescript, currentDirectory, this.project.input, this.project.options);
        this.program = this.project.typescript.createProgram(rootFilenames, this.project.options, this.host, this.program);
        var preEmitDiagnostics = this.project.typescript.getPreEmitDiagnostics(this.program);
        var result = reporter_1.emptyCompilationResult();
        result.optionsErrors = this.program.getOptionsDiagnostics().length;
        result.syntaxErrors = this.program.getSyntacticDiagnostics().length;
        result.globalErrors = this.program.getGlobalDiagnostics().length;
        result.semanticErrors = this.program.getSemanticDiagnostics().length;
        if (this.project.options.declaration) {
            result.declarationErrors = this.program.getDeclarationDiagnostics().length;
        }
        this.reportDiagnostics(preEmitDiagnostics);
        var emitOutput = this.program.emit();
        result.emitErrors = emitOutput.diagnostics.length;
        result.emitSkipped = emitOutput.emitSkipped;
        if (this.project.singleOutput) {
            this.emitFile(result, currentDirectory);
        }
        else {
            // Emit files one by one
            for (var _i = 0, _a = this.host.input.getFileNames(true); _i < _a.length; _i++) {
                var fileName = _a[_i];
                var file = this.project.input.getFile(fileName);
                this.emitFile(result, currentDirectory, file);
            }
        }
        this.project.output.finish(result);
    };
    ProjectCompiler.prototype.emitFile = function (result, currentDirectory, file) {
        var jsFileName;
        var dtsFileName;
        var jsContent;
        var dtsContent;
        var jsMapContent;
        var emitOutput = this.program.emit(file && file.ts, function (fileName, content) {
            var _a = utils.splitExtension(fileName, ['d.ts']), extension = _a[1];
            switch (extension) {
                case 'js':
                case 'jsx':
                    jsFileName = fileName;
                    jsContent = content;
                    break;
                case 'd.ts':
                    dtsFileName = fileName;
                    dtsContent = content;
                    break;
                case 'map':
                    jsMapContent = content;
                    break;
            }
        });
        result.emitErrors += emitOutput.diagnostics.length;
        this.reportDiagnostics(emitOutput.diagnostics);
        if (emitOutput.emitSkipped) {
            result.emitSkipped = true;
        }
        if (!jsFileName)
            return;
        var base;
        var baseDeclarations;
        if (file) {
            base = file.gulp.base;
            if (this.project.options.outDir) {
                var baseRelative = path.relative(this.project.options.rootDir, base);
                base = path.join(this.project.options.outDir, baseRelative);
            }
            baseDeclarations = base;
            if (this.project.options.declarationDir) {
                var baseRelative = path.relative(this.project.options.rootDir, file.gulp.base);
                baseDeclarations = path.join(this.project.options.declarationDir, baseRelative);
            }
        }
        else if (this.project.options.outFile) {
            base = this.project.directory;
            baseDeclarations = base;
        }
        else {
            var outFile = this.project.options.out;
            base = jsFileName.substring(0, jsFileName.length - outFile.length);
            baseDeclarations = base;
        }
        if (jsContent !== undefined) {
            if (jsMapContent !== undefined) {
                jsContent = this.removeSourceMapComment(jsContent);
            }
            this.project.output.writeJs(base, jsFileName, jsContent, jsMapContent, file ? file.gulp.cwd : currentDirectory, file);
        }
        if (dtsContent !== undefined) {
            this.project.output.writeDts(baseDeclarations, dtsFileName, dtsContent, file ? file.gulp.cwd : currentDirectory);
        }
    };
    ProjectCompiler.prototype.reportDiagnostics = function (diagnostics) {
        for (var _i = 0, diagnostics_1 = diagnostics; _i < diagnostics_1.length; _i++) {
            var error = diagnostics_1[_i];
            this.project.output.diagnostic(error);
        }
    };
    ProjectCompiler.prototype.removeSourceMapComment = function (content) {
        // By default the TypeScript automaticly inserts a source map comment.
        // This should be removed because gulp-sourcemaps takes care of that.
        // The comment is always on the last line, so it's easy to remove it
        // (But the last line also ends with a \n, so we need to look for the \n before the other)
        var index = content.lastIndexOf('\n', content.length - 2);
        return content.substring(0, index) + '\n';
    };
    return ProjectCompiler;
}());
exports.ProjectCompiler = ProjectCompiler;
var FileCompiler = (function () {
    function FileCompiler() {
        this.output = {};
        this.previousOutput = {};
        this.compilationResult = undefined;
    }
    FileCompiler.prototype.prepare = function (project) {
        this.project = project;
        this.project.input.noParse = true;
        this.compilationResult = reporter_1.emptyCompilationResult();
    };
    FileCompiler.prototype.write = function (file, fileName, diagnostics, content, sourceMap) {
        this.output[file.fileNameNormalized] = { fileName: fileName, diagnostics: diagnostics, content: content, sourceMap: sourceMap };
        for (var _i = 0, diagnostics_2 = diagnostics; _i < diagnostics_2.length; _i++) {
            var error = diagnostics_2[_i];
            this.project.output.diagnostic(error);
        }
        this.compilationResult.transpileErrors += diagnostics.length;
        this.project.output.writeJs(file.gulp.base, fileName, content, sourceMap, file.gulp.cwd, file);
    };
    FileCompiler.prototype.inputFile = function (file) {
        if (file.fileNameNormalized.substr(file.fileNameNormalized.length - 5) === '.d.ts') {
            return; // Don't compile definition files
        }
        if (this.project.input.getFileChange(file.fileNameOriginal).state === input_1.FileChangeState.Equal) {
            // Not changed, re-use old file.
            var old = this.previousOutput[file.fileNameNormalized];
            this.write(file, old.fileName, old.diagnostics, old.content, old.sourceMap);
            return;
        }
        var diagnostics = [];
        var outputString = this.project.typescript.transpile(file.content, this.project.options, file.fileNameOriginal, diagnostics);
        var index = outputString.lastIndexOf('\n');
        var mapString = outputString.substring(index + 1);
        if (mapString.substring(0, 1) === '\r')
            mapString = mapString.substring(1);
        var start = '//# sourceMappingURL=data:application/json;base64,';
        if (mapString.substring(0, start.length) !== start) {
            console.error('Couldn\'t read the sourceMap generated by TypeScript. This is likely an issue with gulp-typescript.');
            return;
        }
        mapString = mapString.substring(start.length);
        var map = JSON.parse(new Buffer(mapString, 'base64').toString());
        // TODO: Set paths correctly
        // map.sourceRoot = path.resolve(file.gulp.cwd, file.gulp.base);
        // map.sources[0] = path.relative(map.sourceRoot, file.gulp.path);
        var fileNameExtensionless = utils.splitExtension(file.fileNameOriginal)[0];
        var _a = utils.splitExtension(map.file), extension = _a[1]; // js or jsx
        this.write(file, fileNameExtensionless + '.' + extension, diagnostics, outputString.substring(0, index), JSON.stringify(map));
    };
    FileCompiler.prototype.inputDone = function () {
        this.project.output.finish(this.compilationResult);
        this.previousOutput = this.output;
        this.output = {};
    };
    return FileCompiler;
}());
exports.FileCompiler = FileCompiler;
