///<reference path='../typings/tsd.d.ts'/>
var ts = require('typescript');
var vfs = require('vinyl-fs');
var path = require('path');
var input = require('./input');
var output = require('./output');
var Project = (function () {
    function Project(configFileName, config, options, noExternalResolve, sortOutput, typescript) {
        if (typescript === void 0) { typescript = ts; }
        this.typescript = typescript;
        this.configFileName = configFileName;
        this.config = config;
        this.options = options;
        this.noExternalResolve = noExternalResolve;
        this.sortOutput = sortOutput;
        this.singleOutput = options.out !== undefined;
        this.input = new input.FileCache(typescript, options);
    }
    /**
     * Resets the compiler.
     * The compiler needs to be reset for incremental builds.
     */
    Project.prototype.reset = function (outputJs, outputDts) {
        this.input.reset();
        this.previousOutput = this.output;
        this.output = new output.Output(this, outputJs, outputDts);
    };
    Project.prototype.src = function () {
        if (!this.config.files) {
            throw new Error('gulp-typescript: You can only use src() if the \'files\' property exists in your tsconfig.json. Use gulp.src(\'**/**.ts\') instead.');
        }
        var base = path.dirname(this.configFileName);
        if (this.config.compilerOptions && this.config.compilerOptions.rootDir) {
            base = path.resolve(base, this.config.compilerOptions.rootDir);
        }
        return vfs.src(this.config.files.map(function (file) { return path.resolve(base, file); }), { base: base });
    };
    return Project;
})();
exports.Project = Project;
