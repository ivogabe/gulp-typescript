import ts = require('typescript');
import tsApi = require('./tsapi');
import path = require('path');
import project = require('./project');
import main = require('./main');
import file = require('./file');
import utils = require('./utils');

export class Filter {
	project: project.Project;
	constructor(_project: project.Project, filters: main.FilterSettings) {
		this.project = _project;

		if (filters.referencedFrom !== undefined) {
			this.referencedFrom = this.mapFilenamesToFiles(filters.referencedFrom);

			this.referencedFromAll = [];

			var addReference = (file: file.File) => {
				if (this.referencedFromAll.indexOf(file.fileNameNormalized) !== -1) return;

				this.referencedFromAll.push(file.fileNameNormalized);

				for (var i = 0; i < file.ts.referencedFiles.length; i++) {
					var ref = tsApi.getFileName(file.ts.referencedFiles[i]);
					ref = utils.normalizePath(path.join(path.dirname(tsApi.getFileName(file.ts)), ref));

					var refFile = this.project.files.getFile(ref);
					if (refFile) addReference(refFile);
				}
			};

			for (var i = 0; i < this.referencedFrom.length; i++) {
				addReference(this.referencedFrom[i]);
			}
		}
	}

	private mapFilenamesToFiles(filenames: string[]) {
		var files: file.File[] = [];
		for (var i = 0; i < filenames.length; i++) {
			var file = this.getFile(filenames[i]);
			if (file === undefined) {
				console.log('gulp-typescript: Could not find file ' + filenames[i]);
			} else {
				files.push(file);
			}
		}
		return files;
	}

	private getFile(filename: string): file.File {
		var fileNames = this.project.files.getFileNames(true);
		for (const fileName of fileNames) {
			const _file = this.project.files.getFile(fileName);
			if (!_file) console.log(fileName);
			if (_file.gulp && _file.gulp.path.substring(_file.gulp.base.length) === filename) {
				return _file;
			}
		}
		return undefined;
	}

	private referencedFrom: file.File[] = undefined;
	private referencedFromAll: string[] = undefined;

	match(filename: string) {
		var originalFilename = utils.normalizePath(filename);
		originalFilename = this.project.getOriginalName(originalFilename);
		var file = this.project.files.getFile(originalFilename);

		if (!file) {
			console.log('gulp-typescript: Could not find file ' + filename + '. Make sure you don\'t rename a file before you pass it to ts.filter()');
		}

		if (this.referencedFrom !== undefined) {
			if (!this.matchReferencedFrom(filename, originalFilename, file)) {
				return false;
			}
		}

		return true;
	}

	private matchReferencedFrom(filename: string, originalFilename: string, _file: file.File) {
		return this.referencedFromAll.indexOf(originalFilename) !== -1;
	}
}
