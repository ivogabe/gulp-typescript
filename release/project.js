///<reference path='../definitions/ref.d.ts'/>
var ts = require('typescript');
var input = require('./input');
var output = require('./output');
var Project = (function () {
    function Project(options, noExternalResolve, sortOutput, typescript) {
        if (typescript === void 0) { typescript = ts; }
        this.typescript = typescript;
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
        this.output = new output.Output(this, outputJs, outputDts);
    };
    return Project;
})();
exports.Project = Project;
