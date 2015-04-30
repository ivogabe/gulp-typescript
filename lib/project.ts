///<reference path='../typings/tsd.d.ts'/>

import stream = require('stream');
import ts = require('typescript');
import tsApi = require('./tsapi');
import main = require('./main');
import host = require('./host');
import reporter = require('./reporter');
import input = require('./input');
import output = require('./output');
import compiler = require('./compiler');

export class Project {
	input: input.FileCache;
	output: output.Output;
	previousOutput: output.Output;
	compiler: compiler.ICompiler;

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

	filterSettings: main.FilterSettings;

	singleOutput: boolean;

	reporter: reporter.Reporter;

	// endregion

	currentDirectory: string;

	constructor(options: ts.CompilerOptions, noExternalResolve: boolean, sortOutput: boolean, typescript = ts) {
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
	reset(outputJs: stream.Readable, outputDts: stream.Readable) {
		this.input.reset();
		this.previousOutput = this.output;
		this.output = new output.Output(this, outputJs, outputDts);
	}
}
