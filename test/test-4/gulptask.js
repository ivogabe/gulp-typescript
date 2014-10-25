var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');

module.exports = function(newTS) {
	var errors = 0;
	var tsResult = gulp.src('test/test-4/*.ts')
					   .pipe(newTS());

	tsResult.on('error', function(err) {
		errors++;
		console.log('[test-4] Caught error:', err.message, 'This error was intentional');
	});

	tsResult.js.on('end', function() {
		if (errors !== 1) {
			console.log('[test-4] ' + gutil.colors.red('Expected 1 error, got ' + errors + '.'));
		}
	});

	tsResult.dts.pipe(gulp.dest('test/output/test-4/dts'));
	return tsResult.js
			.pipe(sourcemaps.write({ includeContent: false, sourceRoot: '../../../test-4/' }))
			.pipe(gulp.dest('test/output/test-4/js'));
}
