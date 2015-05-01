var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');
var concat = require('gulp-concat');

module.exports = function(newTS, lib, output, reporter) {
	var project = newTS.createProject({
		declarationFiles: true,
		noExternalResolve: true,
		sortOutput: true,
		typescript: lib
	});

	return gulp.src('test/filter-referencedFrom/**.ts')
		.pipe(sourcemaps.init())
		.pipe(newTS(project, undefined, reporter))
		.pipe(newTS.filter(project, { referencedFrom: ['test-1.ts'] }))
		.pipe(concat('concat.js'))
		.pipe(sourcemaps.write('.', { includeContent: false, sourceRoot: '../../../../filter-referencedFrom/' }))
		.pipe(gulp.dest(output + 'js'));
}
