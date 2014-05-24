declare module 'vinyl-sourcemaps-apply' {
	import gutil = require('gulp-util');

	function apply(file: gutil.File, map: any);
	export = apply;
}
