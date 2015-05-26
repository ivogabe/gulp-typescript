///<reference path='../typings/tsd.d.ts'/>

import * as stream from 'stream';
import * as ts from 'typescript';
import * as vfs from 'vinyl-fs';
import * as path from 'path';
import * as tsApi from './tsapi';
import { FilterSettings } from './main';
import { Reporter } from './reporter';
import { FileCache } from './input';
import { Output } from './output';
import { ICompiler } from './compiler';
import { TsConfig } from './tsconfig';

export class Project {
	input: FileCache;
	output: Output;
	previousOutput: Output;
	compiler: ICompiler;
	
	configFileName: string;
	config: TsConfig;

	// region settings

	/**
	 * The TypeScript library that is used for this project.
	 * Can also be jsx-typescript for example.
	 */
	typescript: typeof ts;

	options: ts.CompilerOptions;

	/**
	 * Whether there should not be loaded external files to the project.
	 * Example:
	 *   In the lib directory you have .ts files.
	 *   In the definitions directory you have the .d.ts files.
	 *   If you turn this option on, you should add in your gulp file the definitions directory as an input source.
	 * Advantage:
	 * - Faster builds
	 * Disadvantage:
	 * - If you forget some directory, your compile will fail.
	 */
	noExternalResolve: boolean;

	/**
	 * Sort output based on <reference> tags.
	 * tsc does this when you pass the --out parameter.
	 */
	sortOutput: boolean;

	filterSettings: FilterSettings;

	singleOutput: boolean;

	reporter: Reporter;

	// endregion

	currentDirectory: string;

	constructor(configFileName: string, config: TsConfig, options: ts.CompilerOptions, noExternalResolve: boolean, sortOutput: boolean, typescript = ts) {
		this.typescript = typescript;
		this.configFileName = configFileName;
		this.config = config;
		this.options = options;

		this.noExternalResolve = noExternalResolve;
		this.sortOutput = sortOutput;
		this.singleOutput = options.out !== undefined;

		this.input = new FileCache(typescript, options);
	}

	/**
	 * Resets the compiler.
	 * The compiler needs to be reset for incremental builds.
	 */
	reset(outputJs: stream.Readable, outputDts: stream.Readable) {
		this.input.reset();
		this.previousOutput = this.output;
		this.output = new Output(this, outputJs, outputDts);
	}
	
	src() {
		if (!this.config.files) {
			throw new Error('gulp-typescript: You can only use src() if the \'files\' property exists in your tsconfig.json. Use gulp.src(\'**/**.ts\') instead.');
		}
		
		let base = path.dirname(this.configFileName);
		if (this.config.compilerOptions && this.config.compilerOptions.rootDir) {
			base = path.resolve(base, this.config.compilerOptions.rootDir);
		}
		
		return vfs.src(this.config.files.map(file => path.resolve(base, file)), { base });
	}
}
