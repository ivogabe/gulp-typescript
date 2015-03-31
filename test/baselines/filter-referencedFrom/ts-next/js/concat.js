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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImEudHMiLCJpbXBsaWNpdFJlZmVyZW5jZWQudHMiLCJ6LnRzIiwidGVzdC0xLnRzIl0sIm5hbWVzIjpbIkNsYXNzQSIsIkNsYXNzQS5jb25zdHJ1Y3RvciIsIkNsYXNzQS5mb28iLCJNb2QiLCJNb2QuZm9vIiwiQ2xhc3NaIiwiQ2xhc3NaLmNvbnN0cnVjdG9yIiwiQ2xhc3NaLmJhciIsIk1vZC5sb3JlbSIsIlRlc3RDbGFzcyIsIlRlc3RDbGFzcy5jb25zdHJ1Y3RvciIsIk1vZC5iYXIiXSwibWFwcGluZ3MiOiJBQUFBO0lBQUFBO0lBSUFDLENBQUNBO0lBSEFELG9CQUFHQSxHQUFIQTtJQUVBRSxDQUFDQTtJQUNGRixhQUFDQTtBQUFEQSxDQUpBLEFBSUNBLElBQUE7QUFFRCxJQUFPLEdBQUcsQ0FFVDtBQUZELFdBQU8sR0FBRyxFQUFDLENBQUM7SUFDWEc7SUFBdUJDLENBQUNBO0lBQVJELE9BQUdBLE1BQUtBLENBQUFBO0FBQ3pCQSxDQUFDQSxFQUZNLEdBQUcsS0FBSCxHQUFHLFFBRVQ7O0FDUkQsSUFBSSxrQkFBa0IsR0FBRyxxQkFBcUIsQ0FBQzs7Ozs7Ozs7QUNBL0MsQUFFQSw2QkFGNkI7QUFDN0IsOENBQThDOztJQUN6QkUsMEJBQU1BO0lBQTNCQTtRQUFxQkMsOEJBQU1BO0lBSTNCQSxDQUFDQTtJQUhBRCxvQkFBR0EsR0FBSEE7SUFFQUUsQ0FBQ0E7SUFDRkYsYUFBQ0E7QUFBREEsQ0FKQSxBQUlDQSxFQUpvQixNQUFNLEVBSTFCO0FBRUQsSUFBTyxHQUFHLENBRVQ7QUFGRCxXQUFPLEdBQUcsRUFBQyxDQUFDO0lBQ1hGO0lBQXlCSyxDQUFDQTtJQUFWTCxTQUFLQSxRQUFLQSxDQUFBQTtBQUMzQkEsQ0FBQ0EsRUFGTSxHQUFHLEtBQUgsR0FBRyxRQUVUOztBQ1ZELDZCQUE2QjtBQUM3Qiw2QkFBNkI7QUFFN0I7SUFBQU07SUFFQUMsQ0FBQ0E7SUFBREQsZ0JBQUNBO0FBQURBLENBRkEsQUFFQ0EsSUFBQTtBQUVELElBQUksQ0FBQyxHQUFHLElBQUksU0FBUyxFQUFFLENBQUM7QUFFeEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxNQUFNLEVBQUUsRUFBRSxJQUFJLE1BQU0sRUFBRSxDQUFDLENBQUM7QUFFM0MsSUFBTyxHQUFHLENBRVQ7QUFGRCxXQUFPLEdBQUcsRUFBQyxDQUFDO0lBQ1hOO0lBQXVCUSxDQUFDQTtJQUFSUixPQUFHQSxNQUFLQSxDQUFBQTtBQUN6QkEsQ0FBQ0EsRUFGTSxHQUFHLEtBQUgsR0FBRyxRQUVUIiwiZmlsZSI6ImNvbmNhdC5qcyIsInNvdXJjZVJvb3QiOiIuLi8uLi8uLi8uLi9maWx0ZXItcmVmZXJlbmNlZEZyb20vIn0=