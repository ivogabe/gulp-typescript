"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
var path = require("path");
var _project = require("./project");
var utils = require("./utils");
var _reporter = require("./reporter");
function compile(param, theReporter) {
    if (arguments.length >= 3) {
        utils.deprecate("Reporter are now passed as the second argument", "remove the second argument", "Filters have been removed as of gulp-typescript 3.0.\nThe reporter is now passed as the second argument instead of the third argument.");
    }
    var proj;
    if (typeof param === "function") {
        proj = param;
        if (arguments.length >= 2) {
            utils.deprecate("ts(tsProject, ...) has been deprecated", "use .pipe(tsProject(reporter)) instead", "As of gulp-typescript 3.0, .pipe(ts(tsProject, ...)) should be written as .pipe(tsProject(reporter)).");
        }
        else {
            utils.deprecate("ts(tsProject) has been deprecated", "use .pipe(tsProject(reporter)) instead", "As of gulp-typescript 3.0, .pipe(ts(tsProject)) should be written as .pipe(tsProject()).");
        }
    }
    else {
        proj = compile.createProject(param || {});
    }
    return proj(theReporter);
}
function getTypeScript(typescript) {
    if (typescript)
        return typescript;
    try {
        return require('typescript');
    }
    catch (e) {
        utils.deprecate("TypeScript not installed", "install with `npm install typescript --save-dev`", "As of gulp-typescript 3.0, TypeScript isn't bundled with gulp-typescript any more.\nInstall the latest stable version with `npm install typescript --save-dev`\nor a nightly with `npm install typescript@next --save-dev`");
        throw new Error("TypeScript not installed");
    }
}
function checkAndNormalizeSettings(settings) {
    if (settings.sourceRoot !== undefined) {
        console.warn('gulp-typescript: sourceRoot isn\'t supported any more. Use sourceRoot option of gulp-sourcemaps instead.');
    }
    if (settings.noExternalResolve !== undefined) {
        utils.deprecate("noExternalResolve is deprecated", "use noResolve instead", "The non-standard option noExternalResolve has been removed as of gulp-typescript 3.0.\nUse noResolve instead.");
    }
    if (settings.sortOutput !== undefined) {
        utils.deprecate("sortOutput is deprecated", "your project might work without it", "The non-standard option sortOutput has been removed as of gulp-typescript 3.0.\nYour project will probably compile without this option.\nOtherwise, if you're using gulp-concat, you should remove gulp-concat and use the outFile option instead.");
    }
    if (settings.declarationFiles) {
        settings.declaration = settings.declarationFiles;
        delete settings.declarationFiles;
    }
    delete settings.noExternalResolve;
    delete settings.sortOutput;
    delete settings.typescript;
}
function normalizeCompilerOptions(options) {
    options.sourceMap = true;
    options.suppressOutputPathCheck = true;
    options.inlineSourceMap = false;
    options.sourceRoot = undefined;
    options.inlineSources = false;
}
function reportErrors(errors, typescript) {
    var reporter = _reporter.defaultReporter();
    for (var _i = 0, errors_1 = errors; _i < errors_1.length; _i++) {
        var error = errors_1[_i];
        reporter.error(utils.getError(error, typescript), typescript);
    }
}
(function (compile) {
    compile.reporter = _reporter;
    function createProject(fileNameOrSettings, settings) {
        var tsConfigFileName = undefined;
        var tsConfigContent = undefined;
        var projectDirectory = process.cwd();
        var typescript;
        var compilerOptions;
        var fileName;
        settings = __assign({}, settings); // Shallow copy the settings.
        if (fileNameOrSettings !== undefined) {
            if (typeof fileNameOrSettings === 'string') {
                fileName = fileNameOrSettings;
            }
            else {
                settings = fileNameOrSettings || {};
            }
            typescript = getTypeScript(settings.typescript);
            checkAndNormalizeSettings(settings);
            var settingsResult = typescript.convertCompilerOptionsFromJson(settings, projectDirectory);
            if (settingsResult.errors) {
                reportErrors(settingsResult.errors, typescript);
            }
            compilerOptions = settingsResult.options;
            if (fileName) {
                tsConfigFileName = path.resolve(process.cwd(), fileNameOrSettings);
                projectDirectory = path.dirname(tsConfigFileName);
                var tsConfig = typescript.readConfigFile(tsConfigFileName, typescript.sys.readFile);
                if (tsConfig.error) {
                    console.log(tsConfig.error.messageText);
                }
                var parsed = tsConfig.config &&
                    typescript.parseJsonConfigFileContent(tsConfig.config, typescript.sys, path.resolve(projectDirectory), settings, path.basename(tsConfigFileName));
                tsConfigContent = {
                    compilerOptions: parsed.options,
                    files: parsed.fileNames,
                };
                if (parsed.errors) {
                    reportErrors(parsed.errors, typescript);
                }
                compilerOptions = parsed.options;
            }
        }
        normalizeCompilerOptions(compilerOptions);
        var project = _project.setupProject(projectDirectory, tsConfigContent, compilerOptions, typescript);
        return project;
    }
    compile.createProject = createProject;
    function filter() {
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        utils.deprecate('ts.filter() is deprecated', 'soon you can use tsProject.resolve()', 'Filters have been removed as of gulp-typescript 3.0.\nSoon tsProject.resolve() will be available as an alternative.\nSee https://github.com/ivogabe/gulp-typescript/issues/190.');
    }
    compile.filter = filter;
})(compile || (compile = {}));
module.exports = compile;
