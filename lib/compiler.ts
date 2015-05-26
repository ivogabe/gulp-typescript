import * as ts from 'typescript';
import * as path from 'path';
import * as gutil from 'gulp-util';
import { RawSourceMap } from 'source-map';
import * as tsApi from './tsapi';
import { File } from './input';
import { Output, OutputFileKind } from './output';
import { Host } from './host';
import { Project } from './project';
import { Filter } from './filter';
import * as utils from './utils';

export interface ICompiler {
	prepare(_project: Project): void;
	inputFile(file: File);
	inputDone();
	/**
	 * Corrects the paths in the sourcemap.
	 * Returns true when the file is located
	 * under the base path.
	 */
	correctSourceMap(map: RawSourceMap): boolean;
}

/**
 * Compiles a whole project, with full type checking
 */
export class ProjectCompiler implements ICompiler {
	host: Host;
	project: Project;
	program: ts.Program;

	prepare(_project: Project) {
		this.project = _project;
	}

	inputFile(file: File) { }

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
				this.project.output.write(file.fileName + '.js', file.content[OutputFileKind.JavaScript]);
				this.project.output.write(file.fileName + '.js.map', file.content[OutputFileKind.SourceMap]);
				if (file.content[OutputFileKind.Definitions] !== undefined) {
					this.project.output.write(file.fileName + '.d.ts', file.content[OutputFileKind.Definitions]);
				}
			}

			return;
		}
		
		let root = this.project.input.commonBasePath;
		this.project.options.sourceRoot = root;
		(<any> this.project.options).rootDir = root; // rootDir was added in 1.5 & not available in 1.4
		
		this.host = new Host(
			this.project.typescript,
			this.project.currentDirectory,
			this.project.input,
			!this.project.noExternalResolve,
			this.project.options.target >= ts.ScriptTarget.ES6 ? 'lib.es6.d.ts' : 'lib.d.ts'
		);

		let rootFilenames: string[] = this.project.input.getFileNames(true);

		if (this.project.filterSettings !== undefined) {
			let filter = new Filter(this.project, this.project.filterSettings);
			rootFilenames = rootFilenames.filter((fileName) => filter.match(fileName));
		}
		
		if (tsApi.isTS14(this.project.typescript) && !this.project.singleOutput) {
			// Add an empty file under the root, as the rootDir option is not supported in TS1.4.
			let emptyFileName = path.join(root, '________________empty.ts')
			rootFilenames.push(emptyFileName);
			this.project.input.addContent(emptyFileName, '');
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
	
	correctSourceMap(map: RawSourceMap) {
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
		}
		
		return true;
	}
}

// TODO: file-based compiler
