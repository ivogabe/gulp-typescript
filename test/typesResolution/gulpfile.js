var gulp = require('gulp');
var newTS = require('../../release-2/main');
var lib = require('../../typescript/dev');

//
// This is a minimal gulpfile designed to cause the error reported in #563. It
// does not produce output because we don't need the output.
//
// This gulpfile must be executed with a `gulp` process lauched with its `cwd`
// set to the directory that contains this gulpfile. Launching it from the
// `gulp-typescript` project root **WILL NOT** trigger the conditions that cause
// the problem.
//

gulp.task('default', function () {
        var tsProject = newTS.createProject('./sub/tsconfig.json', {
                typescript: lib,
        });

        return tsProject.src()
                .pipe(tsProject());
});
