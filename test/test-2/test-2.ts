/// <reference path="referenced.d.ts"/>
import other = require('./other-2');
import someModule = require('someModule');

var a = new other.Hello();
console.log(a.value);

console.log(someModule);
