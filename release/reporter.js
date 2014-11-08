var ts = require('../typescript/ts');
///<reference path='../definitions/ref.d.ts'/>
function nullReporter() {
    return {};
}
exports.nullReporter = nullReporter;
function defaultReporter() {
    return {
        error: function (error) {
            console.error(error.message);
        }
    };
}
exports.defaultReporter = defaultReporter;
