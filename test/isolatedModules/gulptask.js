var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');
var plumber = require('gulp-plumber');

module.exports = function(newTS, lib, output, reporter) {
	var tsProject = newTS.createProject('test/isolatedModules/tsconfig.json', {
		typescript: lib
	});
	
	var tsResult = tsProject.src()
		.pipe(plumber())
		.pipe(sourcemaps.init())
		.pipe(tsProject(reporter))
		.on('error', () => {});

	tsResult.dts.pipe(gulp.dest(output + '/dts'));
	return tsResult.js
		.pipe(sourcemaps.write('.', { sourceRoot: '../../../../isolatedModules/' }))
		.pipe(gulp.dest(output + 'js'));
}
