import ts = require('typescript');
import path = require('path');
import gutil = require('gulp-util');
import sourceMap = require('source-map');
import tsApi = require('./tsapi');
import input = require('./input');
import output = require('./output');
import host = require('./host');
import project = require('./project');
import filter = require('./filter');
import utils = require('./utils');

export interface ICompiler {
	prepare(_project: project.Project): void;
	inputFile(file: input.File);
	inputDone();
	/**
	 * Corrects the paths in the sourcemap.
	 * Returns true when the file is located
	 * under the base path.
	 */
	correctSourceMap(map: sourceMap.RawSourceMap): boolean;
}

/**
 * Compiles a whole project, with full type checking
 */
export class ProjectCompiler implements ICompiler {
	host: host.Host;
	project: project.Project;
	program: ts.Program;

	prepare(_project: project.Project) {
		this.project = _project;
		this.hasThrownSourceDirWarning = false;
	}

	inputFile(file: input.File) { }

	inputDone() {
		if (!this.project.input.firstSourceFile) {
			this.project.output.finish();
			return;
		}

		if (!this.project.input.isChanged(true)) {
			// Re-use old output
			const old = this.project.previousOutput;

			for (const error of old.errors) {
				this.project.output.error(error);
			}

			for (const fileName of Object.keys(old.files)) {
				const file = old.files[fileName];
				this.project.output.write(file.fileName + '.js', file.content[output.OutputFileKind.JavaScript]);
				this.project.output.write(file.fileName + '.js.map', file.content[output.OutputFileKind.SourceMap]);
				if (file.content[output.OutputFileKind.Definitions] !== undefined) {
					this.project.output.write(file.fileName + '.d.ts', file.content[output.OutputFileKind.Definitions]);
				}
			}

			return;
		}
		
		let root = this.project.input.commonBasePath;
		this.project.options.sourceRoot = root;
		(<any> this.project.options).rootDir = root; // rootDir was added in 1.5 & not available in 1.4
		
		this.host = new host.Host(
			this.project.typescript,
			this.project.currentDirectory,
			this.project.input,
			!this.project.noExternalResolve,
			this.project.options.target >= ts.ScriptTarget.ES6 ? 'lib.es6.d.ts' : 'lib.d.ts'
		);

		let rootFilenames: string[] = this.project.input.getFileNames(true);

		if (tsApi.isTS14(this.project.typescript) && !this.project.singleOutput) {
			// Add an empty file under the root, as the rootDir option is not supported in TS1.4.
			let emptyFileName = path.join(root, '________________empty.ts')
			rootFilenames.push(emptyFileName);
			this.project.input.addContent(emptyFileName, '');
		}

		if (this.project.filterSettings !== undefined) {
			let _filter = new filter.Filter(this.project, this.project.filterSettings);
			rootFilenames = rootFilenames.filter((fileName) => _filter.match(fileName));
		}

		// Creating a program to compile the sources
		this.program = this.project.typescript.createProgram(rootFilenames, this.project.options, this.host);

		const errors = tsApi.getDiagnosticsAndEmit(this.program);

		for (let i = 0; i < errors.length; i++) {
			this.project.output.diagnostic(errors[i]);
		}

		for (const fileName in this.host.output) {
			if (!this.host.output.hasOwnProperty(fileName)) continue;

			this.project.output.write(fileName, this.host.output[fileName]);
		}

		this.project.output.finish();
	}
	
	private _commonBaseDiff: [number, string];
	/**
	 * Calculates the difference between the common base directory calculated based on the base paths of the input files
	 * and the common source directory calculated by TypeScript.
	 */
	private get commonBaseDiff(): [number, string] {
		if (this._commonBaseDiff) return this._commonBaseDiff;
		
		const expected = this.project.input.commonBasePath;
		const real = this.project.input.commonSourceDirectory;
		
		const length = real.length - expected.length;
		
		this._commonBaseDiff = [length, real.substring(real.length - length)]
		
		if (length > 0) {
			this._commonBaseDiff = [length, real.substring(real.length - length)];
		} else {
			this._commonBaseDiff = [length, expected.substring(expected.length + length)];
		}
		
		if (this._commonBaseDiff[1] === '/' || this._commonBaseDiff[1] === '\\') {
			this._commonBaseDiff = [0, ''];
		}
		
		return this._commonBaseDiff;
	}
	
	private hasThrownSourceDirWarning = false;
	correctSourceMap(map: sourceMap.RawSourceMap) {
		const [diffLength, diff] = this.commonBaseDiff;
		
		if (this.project.singleOutput) return true;
		
		if (diffLength < 0) {
			// There were files added outside of the common base.
			let outsideRoot = false;
			map.sources = map.sources.map<string>(fileName => {
				const full = utils.normalizePath(path.join(this.project.input.commonSourceDirectory, fileName));
				let relative = path.relative(utils.normalizePath(this.project.input.commonBasePath), full);
				
				const first2 = relative.substring(0, 2);
				const first3 = relative.substring(0, 3);
				if (first3 === '../' || first3 === '..\\') {
					outsideRoot = true;
				} else if (first2 === './' || first2 === '.\\') {
					relative = relative.substring(2);
				}
				return full.substring(full.length - relative.length);
			});
			
			if (outsideRoot) return false;
		} else if (diffLength > 0 && tsApi.isTS14(this.project.typescript)) {
			if (!this.hasThrownSourceDirWarning) {
				this.hasThrownSourceDirWarning = true;
				console.error('The common source directory of the source files isn\'t equal to '
					+ 'the common base directory of the input files. That isn\'t supported '
					+ 'using the version of TypeScript currently used. Use a newer version of TypeScript instead '
					+ 'or have the common source directory point to the common base directory.');
			}
			
			return false;
		}
		
		return true;
	}
}

// TODO: file-based compiler
