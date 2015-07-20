var ClassA = (function () {
    function ClassA() {
    }
    ClassA.prototype.foo = function () {
    };
    return ClassA;
})();
var Mod;
(function (Mod) {
    function foo() {
    }
    Mod.foo = foo;
})(Mod || (Mod = {}));

var implicitReferenced = "Implicit Referenced";

var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
/// <reference path="a.ts" />
/// <reference path="implicitReferenced.ts" />
var ClassZ = (function (_super) {
    __extends(ClassZ, _super);
    function ClassZ() {
        _super.apply(this, arguments);
    }
    ClassZ.prototype.bar = function () {
    };
    return ClassZ;
})(ClassA);
var Mod;
(function (Mod) {
    function lorem() {
    }
    Mod.lorem = lorem;
})(Mod || (Mod = {}));

/// <reference path="a.ts" />
/// <reference path="z.ts" />
var TestClass = (function () {
    function TestClass() {
    }
    return TestClass;
})();
var a = new TestClass();
console.log(a, new ClassA(), new ClassZ());
var Mod;
(function (Mod) {
    function bar() {
    }
    Mod.bar = bar;
})(Mod || (Mod = {}));

//# sourceMappingURL=concat.js.map