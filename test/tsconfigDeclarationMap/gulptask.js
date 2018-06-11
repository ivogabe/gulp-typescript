var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');

module.exports = function(newTS, lib, output, reporter) {
	var project = newTS.createProject('test/tsconfigDeclarationMap/src/tsconfig.json', {
		typescript: lib
	});

	var tsResult = project.src()
		.pipe(sourcemaps.init())
		.pipe(project(reporter))
		.on('error', () => {});

	tsResult.dts
		.pipe(sourcemaps.write("."))
		.pipe(gulp.dest(output + '/dts'));


	return tsResult.js
		.pipe(gulp.dest(output + "js"));
}
