var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');
var concat = require('gulp-concat-sourcemap');

module.exports = function(newTS) {
	var project = newTS.createProject({
		declarationFiles: true,
		noExternalResolve: true,
		sortOutput: true
	});
	
	return gulp.src('test/test-1/**.ts')
		.pipe(sourcemaps.init())
		.pipe(newTS(project))
		.pipe(newTS.filter(project, { referencedFrom: ['test-1.ts'] }))
		.pipe(concat('concat.js'))
		.pipe(sourcemaps.write({ includeContent: false, sourceRoot: '../../../test-1/' }))
		.pipe(gulp.dest('test/output/test-1/js'));
}