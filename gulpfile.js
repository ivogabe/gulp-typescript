var gulp = require('gulp');
var rimraf = require('rimraf');
var fs = require('fs');
var path = require('path');
var ts = require('./release/main');
var argv = require('yargs').argv;

var sourcemaps = require('gulp-sourcemaps');
var concat = require('gulp-concat');
var header = require('gulp-header');
var diff = require('gulp-diff');

var tsOptions = {
	target: 'es5',
	module: 'commonjs',
	noExternalResolve: true,
	preserveConstEnums: true,
	typescript: require('typescript-dev')
};
var tsProject = ts.createProject(tsOptions);

var paths = {
	scripts: ['lib/**.ts', 'typings/**/**.ts'],
	definitionTypeScript: [path.join(path.dirname(require.resolve('typescript')), 'typescript.d.ts')],
	releaseBeta: 'release-2',
	release: 'release'
};

var tests = fs.readdirSync(path.join(__dirname, 'test')).filter(function(dir) {
	return dir !== 'baselines' && dir !== 'output' && dir.substr(0, 1) !== '.';
});

// Clean
gulp.task('clean', function(cb) {
	rimraf(paths.releaseBeta, cb);
});
gulp.task('clean-test', function(cb) {
	rimraf('test/output', cb);
});
gulp.task('clean-release', function(cb) {
	rimraf(paths.release, cb);
});

// Compile sources
gulp.task('scripts', ['clean'], function() {
	var tsResult = gulp.src(paths.scripts.concat(paths.definitionTypeScript))
					   .pipe(ts(tsProject));

	return tsResult.js
		.pipe(gulp.dest(paths.releaseBeta));
});

// Type checking against multiple versions of TypeScript:
// - master of TypeScript (typescript-dev)
// - jsx-typescript (a fork of TypeScript with JSX support, currently disabled, see below)
// Checking against the current release of TypeScript on NPM can be done using `gulp scripts`.
gulp.task('typecheck-dev', function() {
	return gulp.src(paths.scripts.concat([
		'!definitions/typescript.d.ts',
		path.join(path.dirname(require.resolve('typescript-dev')), 'typescript.d.ts')
	])).pipe(ts(tsOptions));
});

// Disabled typechecking for jsx since jsx is currently based on an older, unsupported version of the typescript api
/* gulp.task('typecheck-jsx', function() {
	return gulp.src(paths.scripts.concat([
		'!definitions/typescript.d.ts',
		path.join(path.dirname(require.resolve('jsx-typescript')), './typescript.d.ts')
	])).pipe(ts(tsOptions));
}); */

gulp.task('typecheck', ['typecheck-dev']);

// Tests

// helper function for running a test.
function runTest(name, callback) {
	var newTS = require('./release-2/main');
	// We run every test on multiple typescript versions: current release on NPM and the master from GitHub (typescript-dev).
	var libs = [
		['default', undefined],
		['ts-next', require('typescript-dev')],
		// ['jsx', require('jsx-typescript')] // TODO: Add jsx-typescript here. It currently throws an error when adding it.
	];
	var test = require('./test/' + name + '/gulptask.js');

	var done = 0;

	fs.mkdirSync('test/output/' + name);
	for (var i = 0; i < libs.length; i++) {
		(function(i) {
			var lib = libs[i];
			var output = 'test/output/' + name + '/' + lib[0] + '/';
			var errors = [];
			var reporter = {
				error: function(err) {
					errors.push(err);
				}
			};
			fs.mkdirSync(output);
			test(newTS, lib[1], output, reporter).on('finish', function() {
				fs.writeFileSync(output + 'errors.txt', errors.join('\n'));
				done++;

				if (done === libs.length) compareTest(name, callback);
			});
		})(i);
	}
}
function compareTest(name, callback) {
	var failed = false;
	function onError(error) {
		console.error('Test "' + name + '" failed: ' + error.message);
		failed = true;
		throw error;
	}
	gulp.src('test/output/' + name + '/**/**.**')
		.pipe(diff('test/baselines/' + name + '/'))
		.on('error', onError)
		.pipe(diff.reporter({ fail: true }))
		.on('error', onError)
		.on('finish', function() {
			callback(failed);
		});
}

gulp.task('test', ['clean-test', 'scripts'], function(cb) {
	// Use `gulp test --tests [...]` to run specific test(s).
	// Example: `gulp test --tests basic,errorReporting`

	fs.mkdirSync('test/output/');

	var currentTests = tests;
	if (argv.tests !== undefined) {
		currentTests = argv.tests.split(',');
	}

	var pending = currentTests.length;
	if (pending === 0) {
		cb();
		return;
	}
	
	var isFailed = false;

	for (var i = 0; i < currentTests.length; i++) {
		runTest(currentTests[i], function(failed) {
			isFailed = isFailed || failed;
			pending--;
			if (pending === 0) {
				if (isFailed) {
					cb(new Error('Tests failed'));
				} else {
					cb();
				}
			}
		});
	}
});

// Accept new baselines
gulp.task('test-baselines-accept', function(cb) {
	rimraf('test/baselines', function() {
		gulp.src('test/output/**').pipe(gulp.dest('test/baselines')).on('finish', cb);
	});
});

gulp.task('release', function() {
	return gulp.src(paths.releaseBeta + '/**').pipe(gulp.dest(paths.release));
});

gulp.task('watch', ['scripts'], function() {
	gulp.watch(paths.scripts, ['scripts']);
});

gulp.task('default', ['scripts', 'typecheck', 'test']);
