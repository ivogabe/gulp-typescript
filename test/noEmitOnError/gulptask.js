const gulp = require('gulp');

module.exports = function(newTS, lib, output, reporter) {
	return gulp.src('test/noEmitOnError/**/*.ts')
		.pipe(newTS({ noEmitOnError: true, typescript: lib, outFile: 'foo.js' }, reporter))
		.on('error', () => {})
		.pipe(gulp.dest(output));
};
