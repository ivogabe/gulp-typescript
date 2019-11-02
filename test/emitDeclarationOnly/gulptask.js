const gulp = require('gulp');

module.exports = function(newTS, lib, output, reporter) {
	const tsResult = gulp.src('test/emitDeclarationOnly/**/*.ts')
		.pipe(newTS({ declaration: true, emitDeclarationOnly: true, typescript: lib }, reporter))
		.on('error', () => {})

	tsResult.dts.pipe(gulp.dest(output + 'dts'));
	return tsResult.js.pipe(gulp.dest(output + 'js'));
};

module.exports.match = function (lib) {
	// emitDeclarationOnly was added in TypeScript 2.8.
	const match = /^(\d+)\.(\d+)/.exec(lib.version);
	if (!match) return false
	const major = parseInt(match[0])
	const minor = parseInt(match[1])
	return major > 2 || major === 2 && minor >= 8
}
