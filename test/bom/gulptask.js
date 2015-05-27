var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');

module.exports = function(newTS, lib, output, reporter) {
	var tsProject = newTS.createProject('test/bom/tsconfig.json');
	
	var tsResult = tsProject.src()
		.pipe(newTS(tsProject, undefined, reporter));

	tsResult.dts.pipe(gulp.dest(output + '/dts'));
	return tsResult.js
		.pipe(gulp.dest(output + 'js'));
}
