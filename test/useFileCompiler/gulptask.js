var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');
var plumber = require('gulp-plumber');

module.exports = function(newTS, lib, output, reporter) {
	var tsProject = newTS.createProject('test/useFileCompiler/tsconfig.json', {
		typescript: lib,
	}, {
		useFileCompiler: false
	});
	
	var tsResult = tsProject.src()
		.pipe(plumber())
		.pipe(sourcemaps.init())
		.pipe(tsProject(reporter))
		.on('error', () => {});

	tsResult.dts.pipe(gulp.dest(output + '/dts'));
	return tsResult.js
		.pipe(sourcemaps.write('.', { sourceRoot: '../../../../useFileCompiler/' }))
		.pipe(gulp.dest(output + 'js'));
}
