/// <reference path="a.ts" />
/// <reference path="z.ts" />

class TestClass {
	
}

var a = new TestClass();

console.log(a, new ClassA(), new ClassZ());

module Mod {
	export function bar() {}
}
