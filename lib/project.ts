///<reference path='../definitions/ref.d.ts'/>

import ts = require('typescript');
import tsApi = require('./tsapi');
import main = require('./main');
import gutil = require('gulp-util');
import sourceMap = require('source-map');
import path = require('path');
import stream = require('stream');
import fs = require('fs'); // Only used for readonly access
import host = require('./host');
import filter = require('./filter');
import reporter = require('./reporter');
import utils = require('./utils');
import input = require('./input');

interface OutputFile {
	filename: string;
	content: string;
	sourcemap?: Object;
}



export class Project {
	/**
	 * The TypeScript library that is used for this project.
	 * Can also be jsx-typescript for example.
	 */
	typescript: typeof ts;

	filterSettings: main.FilterSettings;

	/**
	 *
	 */
	firstFile: input.File = undefined;

	private isFileChanged: boolean = false;
	private previousOutputJS: OutputFile[];
	private previousOutputDts: OutputFile[];

	files: input.FileCache;

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

	options: ts.CompilerOptions;
	host: host.Host;
	program: ts.Program;

	constructor(options: ts.CompilerOptions, noExternalResolve: boolean, sortOutput: boolean, typescript = ts) {
		this.typescript = typescript;
		this.options = options;

		this.noExternalResolve = noExternalResolve;
		this.sortOutput = sortOutput;

		this.files = new input.FileCache(typescript, options);
	}

	/**
	 * Resets the compiler.
	 * The compiler needs to be reset for incremental builds.
	 */
	reset() {
		this.firstFile = undefined;

		this.isFileChanged = false;

		this.files.reset();
	}
	/**
	 * Adds a file to the project.
	 */
	addFile(file: gutil.File) {
		this.files.addGulp(file);

		if (!this.firstFile) this.firstFile = this.files.getFile(file.path);
	}
}
