///<reference path='../definitions/ref.d.ts'/>

import typescript = require('typescript-api');
import gutil = require('gulp-util');
import path = require('path');
import stream = require('stream');
import project = require('./project');

var PLUGIN_NAME = 'gulp-typescript';

class CompileStream extends stream.Duplex {
	constructor(proj: project.Project) {
		super({objectMode: true});
		
		this._project = proj;
		
		// Backwards compatibility
		this.js = this;

		// Prevent "Unhandled stream error in pipe" when compilation error occurs.
		this.on('error', () => {}); 
	}
	
	private _project: project.Project;
	
	_write(file: gutil.File, encoding, cb = (err?) => {}) {
		if (!file) return cb();
		
		if (file.isNull()) {
			cb();
			return;
		}
		if (file.isStream()) {
			return cb(new gutil.PluginError(PLUGIN_NAME, 'Streaming not supported'));
		}
		
		this._project.addFile(file);
		cb();
	}
	_read() {
		
	}
	
	private compile() {
		this._project.compile(this.js, this.dts, (err) => { 
			console.error(err.message);
			this.emit('error', new gutil.PluginError(PLUGIN_NAME, err.message));
		});
		this.js.push(null);
		this.dts.push(null);
	}
	
	end(chunk?, encoding?, callback?) {
		this._write(chunk, encoding, callback);
		this.compile();
	}
	
	js: stream.Readable;
	dts: stream.Readable = new CompileOutputStream();
}
class CompileOutputStream extends stream.Readable {
	constructor() {
		super({objectMode: true});
	}
	
	_read() {
		
	}
}

function compile();
function compile(proj: project.Project);
function compile(settings: compile.Settings);
function compile(param?: any): any {
	var proj: project.Project;
	if (param instanceof project.Project) {
		proj = param;
	} else {
		proj = new project.Project(getImmutableCompilationSettings(param || {}), (param && param.noExternalResolve) || false, (param && param.sortOutput) || false);
	}
	
	proj.reset();
	
	var inputStream = new CompileStream(proj);
	
	return inputStream;
}

var langMap: project.Map<typescript.LanguageVersion> = {
	'es3': typescript.LanguageVersion.EcmaScript3,
	'es5': typescript.LanguageVersion.EcmaScript5
}
var moduleMap: project.Map<typescript.ModuleGenTarget> = {
	'commonjs': typescript.ModuleGenTarget.Synchronous,
	'amd': typescript.ModuleGenTarget.Asynchronous
}

function getImmutableCompilationSettings(settings: compile.Settings): typescript.ImmutableCompilationSettings {
	var tsSettings = new typescript.CompilationSettings();
	
	if (settings.removeComments !== undefined) {
		tsSettings.removeComments = settings.removeComments;
	}
	
	if (settings.noImplicitAny !== undefined) {
		tsSettings.noImplicitAny = settings.noImplicitAny;
	}
	if (settings.noLib !== undefined) {
		tsSettings.noLib = settings.noLib;
	}
	
	if (settings.target !== undefined) {
		tsSettings.codeGenTarget = langMap[(settings.target || 'es3').toLowerCase()];
	}
	if (settings.module !== undefined) {
		tsSettings.moduleGenTarget = moduleMap[(settings.module || 'none').toLowerCase()];
	}

	if (settings.sourceRoot === undefined) {
		tsSettings.sourceRoot = process.cwd();
	} else {
		tsSettings.sourceRoot = settings.sourceRoot;
	}

	if (settings.declarationFiles !== undefined) {
		tsSettings.generateDeclarationFiles = settings.declarationFiles;
	}
	
	tsSettings.useCaseSensitiveFileResolution = false;
	tsSettings.mapSourceFiles = true;

	return typescript.ImmutableCompilationSettings.fromCompilationSettings(tsSettings);
}

module compile {
	export interface Settings {
		//propagateEnumConstants?: boolean;
		removeComments?: boolean;
		
		//allowAutomaticSemicolonInsertion?: boolean;
		noImplicitAny?: boolean;
		noLib?: boolean;
		target?: string;
		module?: string;
		sourceRoot?: string;

		declarationFiles?: boolean;
		
		//useCaseSensitiveFileResolution?: boolean;
		
		noExternalResolve?: boolean;
		sortOutput?: boolean;
	}
	export import Project = project.Project;
	export function createProject(settings: Settings): Project {
		return new Project(getImmutableCompilationSettings(settings), settings.noExternalResolve ? true : false, settings.sortOutput ? true : false);
	}
}

export = compile;
