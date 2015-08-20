import other = require('./other-3');
. // Syntax error
var a = new other.Hello();
console.log(a.value);