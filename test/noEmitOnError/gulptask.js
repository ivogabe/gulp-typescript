const gulp = require('gulp');

module.exports = function(newTS, lib, output, reporter) {
	return gulp.src('test/noEmitOnError/a.ts')
		.pipe(newTS({ noEmitOnError: true, typescript: lib}, reporter))
		.pipe(gulp.dest(output));
};
