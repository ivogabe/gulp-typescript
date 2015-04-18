import ts = require('typescript');
import gutil = require('gulp-util');
import tsApi = require('./tsApi');
import input = require('./input');
import output = require('./output');
import host = require('./host');
import project = require('./project');
import filter = require('./filter');


export interface ICompiler {
	prepare(inputFiles: input.FileCache, outputFiles: output.Output): void;
	inputFile(file: input.File);
	inputDone();
}

/**
 * Compiles a whole project, with full type checking
 */
export class ProjectCompiler {
	input: input.FileCache;
	output: output.Output;
	host: host.Host;
	project: project.Project;
	program: ts.Program;

	prepare(inputFiles: input.FileCache, outputFiles: output.Output, _project: project.Project) {
		this.input = inputFiles;
		this.output = outputFiles;
		this.project = _project;

		this.output.project = this.project;
		this.output.sortOutput = this.project.sortOutput;
	}

	inputFile(file: input.File) { }

	inputDone() {
		if (!this.input.firstSourceFile) {
			this.output.finish();
			return;
		}

		this.host = new host.Host(this.project.typescript, this.input.firstSourceFile.gulp.cwd, this.input, this.project.noExternalResolve);
		this.output.currentDirectory = this.host.currentDirectory;

		let rootFilenames: string[] = this.input.getFileNames(true);

		if (this.project.filterSettings !== undefined) {
			let _filter = new filter.Filter(this.project, this.project.filterSettings);
			rootFilenames = rootFilenames.filter((fileName) => _filter.match(fileName));
		}

		// Creating a program to compile the sources
		this.program = this.project.typescript.createProgram(rootFilenames, this.project.options, this.host);

		var errors = tsApi.getDiagnosticsAndEmit(this.program);

		for (var i = 0; i < errors.length; i++) {
			this.output.error(errors[i]);
		}

		var outputJS: gutil.File[] = [];
		var sourcemaps: { [ filename: string ]: string } = {};

		for (const fileName in this.host.output) {
			if (!this.host.output.hasOwnProperty(fileName)) continue;

			this.output.write(fileName, this.host.output[fileName]);
		}

		this.output.finish();
	}
}

// TODO: file-based compiler
