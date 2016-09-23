var gulp = require('gulp');

module.exports = function(newTS, lib, output, reporter) {
	return gulp.src('test/noEmit/**/*.ts')
		.pipe(newTS({ noEmit: true, typescript: lib, outFile: 'foo.js' }, reporter))
		.pipe(gulp.dest(output));
}
