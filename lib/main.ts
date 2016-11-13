import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import * as _project from './project';
import * as utils from './utils';
import * as _reporter from './reporter';
import { TsConfig } from './types';

function compile(): compile.CompileStream;
function compile(proj: _project.Project, theReporter?: _reporter.Reporter): compile.CompileStream;
function compile(settings: compile.Settings, theReporter?: _reporter.Reporter): compile.CompileStream;
function compile(param?: any, theReporter?: _reporter.Reporter): compile.CompileStream {
	if (arguments.length >= 3) {
		utils.deprecate("Reporter are now passed as the second argument",
			"remove the second argument",
			"Filters have been removed as of gulp-typescript 3.0.\nThe reporter is now passed as the second argument instead of the third argument.");
	}

	let proj: _project.Project;
	if (typeof param === "function") {
		proj = param;
		if (arguments.length >= 2) {
			utils.deprecate("ts(tsProject, ...) has been deprecated",
				"use .pipe(tsProject(reporter)) instead",
				"As of gulp-typescript 3.0, .pipe(ts(tsProject, ...)) should be written as .pipe(tsProject(reporter)).");
		} else {
			utils.deprecate("ts(tsProject) has been deprecated",
				"use .pipe(tsProject(reporter)) instead",
				"As of gulp-typescript 3.0, .pipe(ts(tsProject)) should be written as .pipe(tsProject()).");
		}
	} else {
		proj = compile.createProject(param || {});
	}
	return proj(theReporter);
}

function getTypeScript(typescript: typeof ts) {
	if (typescript) return typescript;
	try {
		return require('typescript');
	} catch (e) {
		utils.deprecate("TypeScript not installed",
			"install with `npm install typescript --save-dev`",
			"As of gulp-typescript 3.0, TypeScript isn't bundled with gulp-typescript any more.\nInstall the latest stable version with `npm install typescript --save-dev`\nor a nightly with `npm install typescript@next --save-dev`");
		throw new Error("TypeScript not installed");
	}
}

function getCompilerOptions(settings: compile.Settings, projectPath: string, configFileName: string): ts.CompilerOptions {
	let typescript = getTypeScript(settings.typescript);

	if (settings.sourceRoot !== undefined) {
		console.warn('gulp-typescript: sourceRoot isn\'t supported any more. Use sourceRoot option of gulp-sourcemaps instead.')
	}

	if (settings.noExternalResolve !== undefined) {
		utils.deprecate("noExternalResolve is deprecated",
			"use noResolve instead",
			"The non-standard option noExternalResolve has been removed as of gulp-typescript 3.0.\nUse noResolve instead.");
	}
	if (settings.sortOutput !== undefined) {
		utils.deprecate("sortOutput is deprecated",
			"your project might work without it",
			"The non-standard option sortOutput has been removed as of gulp-typescript 3.0.\nYour project will probably compile without this option.\nOtherwise, if you're using gulp-concat, you should remove gulp-concat and use the outFile option instead.");
	}

	// Copy settings and remove several options
	const newSettings: compile.Settings = {};
	for (const option of Object.keys(settings)) {
		if (option === 'declarationFiles') {
			newSettings.declaration = settings.declarationFiles;
			continue;
		}
		if (option === 'noExternalResolve' ||
			option === 'sortOutput' ||
			option === 'typescript' ||
			option === 'sourceMap' ||
			option === 'inlineSourceMap' ||
			option === 'sourceRoot' ||
			option === 'inlineSources') continue;

		newSettings[option] = settings[option];
	}

	const result = typescript.convertCompilerOptionsFromJson(newSettings, projectPath, configFileName);
	const reporter = _reporter.defaultReporter();
	for (const error of result.errors) {
		reporter.error(utils.getError(error, typescript), typescript);
	}
	result.options.sourceMap = true;
	(result.options as any).suppressOutputPathCheck = true;

	return result.options;
}

module compile {
	export interface Settings {
		out?: string;
		outFile?: string;
		outDir?: string;

		allowNonTsExtensions?: boolean;
		charset?: string;
		codepage?: number;
		declaration?: boolean; // alias of declarationFiles
		locale?: string;
		mapRoot?: string;
		noEmitOnError?: boolean;
		noImplicitAny?: boolean;
		noLib?: boolean;
		noLibCheck?: boolean;
		noResolve?: boolean;
		preserveConstEnums?: boolean;
		removeComments?: boolean;
		suppressImplicitAnyIndexErrors?: boolean;

		target?: string | ts.ScriptTarget;
		module?: string | ts.ModuleKind;
		moduleResolution?: string | number;
		jsx?: string | number;

		declarationFiles?: boolean;

		noExternalResolve?: boolean;
		sortOutput?: boolean;

		typescript?: typeof ts;

		isolatedModules?: boolean;

		rootDir?: string;
		rootDirs?: any;

		lib?: string[];
		experimentalDecorators?: boolean;

		[ name: string ]: any;

		// Unsupported by gulp-typescript
		sourceRoot?: string; // Use sourceRoot in gulp-sourcemaps instead
	}
	export type Project = _project.Project;
	export type CompileStream = _project.ICompileStream;
	export import reporter = _reporter;

	export function createProject(settings?: Settings);
	export function createProject(tsConfigFileName: string, settings?: Settings);
	export function createProject(fileNameOrSettings?: string | Settings, settings?: Settings): Project {
		let tsConfigFileName: string = undefined;
		let tsConfigContent: TsConfig = undefined;
		let projectDirectory = process.cwd();
		if (fileNameOrSettings !== undefined) {
			if (typeof fileNameOrSettings === 'string') {
				tsConfigFileName = path.resolve(process.cwd(), fileNameOrSettings);
				projectDirectory = path.dirname(tsConfigFileName);
				// Load file and strip BOM, since JSON.parse fails to parse if there's a BOM present
				let tsConfigText = fs.readFileSync(tsConfigFileName).toString();
				const typescript = getTypeScript(settings && settings.typescript);
				const tsConfig = typescript.parseConfigFileTextToJson(tsConfigFileName, tsConfigText);
				tsConfigContent = tsConfig.config || {};
				if (tsConfig.error) {
					console.log(tsConfig.error.messageText);
				}
				let newSettings: any = {};
				if (tsConfigContent.compilerOptions) {
					for (const key of Object.keys(tsConfigContent.compilerOptions)) {
						newSettings[key] = tsConfigContent.compilerOptions[key];
					}
				}
				if (settings) {
					for (const key of Object.keys(settings)) {
						newSettings[key] = settings[key];
					}
				}
				settings = newSettings;
			} else {
				settings = fileNameOrSettings;
			}
		}

		const project = _project.setupProject(projectDirectory, tsConfigContent, getCompilerOptions(settings, projectDirectory, tsConfigFileName), getTypeScript(settings.typescript));

		return project;
	}

	export function filter(...args: any[]) {
		utils.deprecate('ts.filter() is deprecated',
			'soon you can use tsProject.resolve()',
			'Filters have been removed as of gulp-typescript 3.0.\nSoon tsProject.resolve() will be available as an alternative.\nSee https://github.com/ivogabe/gulp-typescript/issues/190.');
	}
}

export = compile;
