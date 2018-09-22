var ts = require('typescript');

function simpleTransformer() {
    return function (file) {
        return ts.updateSourceFileNode(file, []);
    }
}

module.exports = simpleTransformer;
