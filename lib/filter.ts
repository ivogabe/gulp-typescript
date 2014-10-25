import project = require('./project');
import main = require('./main');

export class Filter {
	project: project.Project;
	constructor(_project: project.Project, filters: main.FilterSettings) {
		this.project = _project;

		if (filters.referencedFrom !== undefined) {
			this.referencedFrom = this.mapFilenamesToFiles(filters.referencedFrom);

			this.referencedFromAll = [];

			var addReference = (file: project.FileData) => {
				if (this.referencedFromAll.indexOf(file.filename) !== -1) return;

				this.referencedFromAll.push(file.filename);

				for (var i = 0; i < file.ts.referencedFiles.length; i++) {
					var ref = file.ts.referencedFiles[i].filename;
					ref = project.Project.normalizePath(ts.combinePaths(ts.getDirectoryPath(file.ts.filename), ref));

					var refFile = this.project.currentFiles[ref];
					if (refFile) addReference(refFile);
				}
			};

			for (var i = 0; i < this.referencedFrom.length; i++) {
				addReference(this.referencedFrom[i]);
			}
		}
	}

	private mapFilenamesToFiles(filenames: string[]) {
		var files: project.FileData[] = [];
		for (var i = 0; i < filenames.length; i++) {
			var file = this.getFile(filenames[i]);
			if (file === undefined) {
				console.log('gulp-typescript: Could not find file ' + filenames[i]);
			}
			files.push(file);
		}
		return files;
	}

	private getFile(filename: string) {
		var files = this.project.currentFiles;
		for (var i in files) {
			if (!files.hasOwnProperty(i)) continue;
			if (files[i].file.path.substring(files[i].file.base.length) == filename) {
				return files[i];
			}
		}
		return undefined;
	}

	private referencedFrom: project.FileData[] = undefined;
	private referencedFromAll: string[] = undefined;

	match(filename: string) {
		var originalFilename = project.Project.normalizePath(filename);
		originalFilename = this.project.getOriginalName(originalFilename);
		var file = this.project.currentFiles[originalFilename];

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

	private matchReferencedFrom(filename: string, originalFilename: string, file: project.FileData) {
		return this.referencedFromAll.indexOf(originalFilename) !== -1;
	}
}
