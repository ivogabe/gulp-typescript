import * as ts from 'typescript';
import * as tsApi from './tsapi';
import * as path from 'path';
import { Project } from './project';
import * as main from './main';
import { File } from './input';
import * as utils from './utils';

export class Filter {
	project: Project;
	constructor(project: Project, filters: main.FilterSettings) {
		this.project = project;

		if (filters.referencedFrom !== undefined) {
			this.referencedFrom = this.mapFilenamesToFiles(filters.referencedFrom);

			this.referencedFromAll = [];

			const addReference = (file: File) => {
				if (this.referencedFromAll.indexOf(file.fileNameNormalized) !== -1) return;

				this.referencedFromAll.push(file.fileNameNormalized);

				for (let i = 0; i < file.ts.referencedFiles.length; i++) {
					let ref = tsApi.getFileName(file.ts.referencedFiles[i]);
					ref = utils.normalizePath(path.join(path.dirname(tsApi.getFileName(file.ts)), ref));

					const refFile = this.project.input.getFile(ref);
					if (refFile) addReference(refFile);
				}
			};

			for (let i = 0; i < this.referencedFrom.length; i++) {
				addReference(this.referencedFrom[i]);
			}
		}
	}

	private mapFilenamesToFiles(filenames: string[]) {
		const files: File[] = [];
		for (let i = 0; i < filenames.length; i++) {
			const file = this.getFile(filenames[i]);
			if (file === undefined) {
				console.log('gulp-typescript: Could not find file ' + filenames[i]);
			} else {
				files.push(file);
			}
		}
		return files;
	}

	private getFile(searchFileName: string): File {
		const fileNames = this.project.input.getFileNames(true);
		for (const fileName of fileNames) {
			const file = this.project.input.getFile(fileName);
			if (!file || !file.gulp) continue;
			const base = path.resolve(
				file.gulp.cwd,
				file.gulp.base
			) + '/';
			if (file.gulp.path.substring(base.length) === searchFileName) {
				return file;
			}
		}
		return undefined;
	}

	private referencedFrom: File[] = undefined;
	private referencedFromAll: string[] = undefined;

	match(fileName: string) {
		let fileNameExtensionless = utils.splitExtension(fileName)[0];
		let outputFile = this.project.output.files[fileNameExtensionless];

		if (!outputFile) {
			console.log('gulp-typescript: Could not find file ' + fileName + '. Make sure you don\'t rename a file before you pass it to ts.filter()');
			return false;
		}

		let file = outputFile.original;

		if (this.referencedFrom !== undefined) {
			if (!this.matchReferencedFrom(fileName, file)) {
				return false;
			}
		}

		return true;
	}

	private matchReferencedFrom(filename: string, file: File) {
		return this.referencedFromAll.indexOf(file.fileNameNormalized) !== -1;
	}
}
