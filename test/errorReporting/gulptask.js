var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');

module.exports = function(newTS, lib, output) {
	var errors = 0;
	var tsResult = gulp.src('test/errorReporting/*.ts')
					   .pipe(newTS({ typescript: lib }, undefined, newTS.reporter.nullReporter()));

	tsResult.on('error', function(err) {
		errors++;
		console.log('[test-errorReporting] Caught error:', err.message, 'This error was intentional');
	});

	tsResult.js.on('end', function() {
		if (errors !== 1) {
			console.log('[test-errorReporting] ' + gutil.colors.red('Expected 1 error, got ' + errors + '.'));
		}
	});

	tsResult.dts.pipe(gulp.dest(output + 'dts'));
	return tsResult.js
			.pipe(sourcemaps.write({ includeContent: false, sourceRoot: '../../../../errorReporting/' }))
			.pipe(gulp.dest(output + 'js'));
}
