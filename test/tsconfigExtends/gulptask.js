var gulp = require('gulp');
var sourcemaps = require('gulp-sourcemaps');

//
// The test here loads tsconfig.json which extends tsconfig-base.json
// If the "extends" parameter is not processed, then only other-3.ts
// will be compiled but not test-3.ts because the latter is only
// included among the compiled files by the tsconfig-base.json file.
//
// tsconfig-base.json also changes the module format to "amd" from the
// default which is "commonjs".
//
// Both the module format change and the file inclusion change are
// meaningful changes, because historically the introduction of
// "extends" made it so that updates to TypeScript tools that read
// tsconfig.json could get one or the other change wrong.
//

module.exports = function(newTS, lib, output, reporter) {
	var tsProject = newTS.createProject('test/tsconfigExtends/tsconfig.json', {
		typescript: lib,
	});

	var tsResult = tsProject.src()
		.pipe(sourcemaps.init())
		.pipe(tsProject(reporter))
		.on('error', () => {});

	tsResult.dts.pipe(gulp.dest(output + '/dts'));
	return tsResult.js
		.pipe(sourcemaps.write('.', { sourceRoot: '../../../../basic/' }))
		.pipe(gulp.dest(output + 'js'));
}
