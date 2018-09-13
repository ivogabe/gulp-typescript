var gulp = require('gulp');
var transformer = require('./simpleTransformer');

module.exports = function(newTS, lib, output, reporter) {
	var getCustomTransformers = function () {
		return {
			// This transformer simply clean file contents.
			before: [transformer],
		};
	};
	var tsProject = newTS.createProject('test/customTransformers/tsconfig.json', { getCustomTransformers, typescript: lib });
	
	var tsResult = tsProject.src()
		.pipe(tsProject(reporter))
		.on('error', () => {});

	return tsResult.js.pipe(gulp.dest(output + 'js'));
}
