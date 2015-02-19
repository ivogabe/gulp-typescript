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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImEudHMiLCJpbXBsaWNpdFJlZmVyZW5jZWQudHMiLCJ6LnRzIiwidGVzdC0xLnRzIl0sIm5hbWVzIjpbIkNsYXNzQSIsIkNsYXNzQS5jb25zdHJ1Y3RvciIsIkNsYXNzQS5mb28iLCJNb2QiLCJNb2QuZm9vIiwiQ2xhc3NaIiwiQ2xhc3NaLmNvbnN0cnVjdG9yIiwiQ2xhc3NaLmJhciIsIk1vZC5sb3JlbSIsIlRlc3RDbGFzcyIsIlRlc3RDbGFzcy5jb25zdHJ1Y3RvciIsIk1vZC5iYXIiXSwibWFwcGluZ3MiOiJBQUFBLElBQU0sTUFBTTtJQUFaQSxTQUFNQSxNQUFNQTtJQUlaQyxDQUFDQTtJQUhBRCxvQkFBR0EsR0FBSEE7SUFFQUUsQ0FBQ0E7SUFDRkYsYUFBQ0E7QUFBREEsQ0FKQSxBQUlDQSxJQUFBO0FBRUQsSUFBTyxHQUFHLENBRVQ7QUFGRCxXQUFPLEdBQUcsRUFBQyxDQUFDO0lBQ1hHLFNBQWdCQSxHQUFHQTtJQUFJQyxDQUFDQTtJQUFSRCxPQUFHQSxHQUFIQSxHQUFRQSxDQUFBQTtBQUN6QkEsQ0FBQ0EsRUFGTSxHQUFHLEtBQUgsR0FBRyxRQUVUOztBQ1JELElBQUksa0JBQWtCLEdBQUcscUJBQXFCLENBQUM7Ozs7Ozs7O0FDQS9DLEFBRUEsNkJBRjZCO0FBQzdCLDhDQUE4QztJQUN4QyxNQUFNO0lBQVNFLFVBQWZBLE1BQU1BLFVBQWVBO0lBQTNCQSxTQUFNQSxNQUFNQTtRQUFTQyw4QkFBTUE7SUFJM0JBLENBQUNBO0lBSEFELG9CQUFHQSxHQUFIQTtJQUVBRSxDQUFDQTtJQUNGRixhQUFDQTtBQUFEQSxDQUpBLEFBSUNBLEVBSm9CLE1BQU0sRUFJMUI7QUFFRCxJQUFPLEdBQUcsQ0FFVDtBQUZELFdBQU8sR0FBRyxFQUFDLENBQUM7SUFDWEYsU0FBZ0JBLEtBQUtBO0lBQUlLLENBQUNBO0lBQVZMLFNBQUtBLEdBQUxBLEtBQVVBLENBQUFBO0FBQzNCQSxDQUFDQSxFQUZNLEdBQUcsS0FBSCxHQUFHLFFBRVQ7O0FDVkQsNkJBQTZCO0FBQzdCLDZCQUE2QjtBQUU3QixJQUFNLFNBQVM7SUFBZk0sU0FBTUEsU0FBU0E7SUFFZkMsQ0FBQ0E7SUFBREQsZ0JBQUNBO0FBQURBLENBRkEsQUFFQ0EsSUFBQTtBQUVELElBQUksQ0FBQyxHQUFHLElBQUksU0FBUyxFQUFFLENBQUM7QUFFeEIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsSUFBSSxNQUFNLEVBQUUsRUFBRSxJQUFJLE1BQU0sRUFBRSxDQUFDLENBQUM7QUFFM0MsSUFBTyxHQUFHLENBRVQ7QUFGRCxXQUFPLEdBQUcsRUFBQyxDQUFDO0lBQ1hOLFNBQWdCQSxHQUFHQTtJQUFJUSxDQUFDQTtJQUFSUixPQUFHQSxHQUFIQSxHQUFRQSxDQUFBQTtBQUN6QkEsQ0FBQ0EsRUFGTSxHQUFHLEtBQUgsR0FBRyxRQUVUIiwiZmlsZSI6ImNvbmNhdC5qcyIsInNvdXJjZVJvb3QiOiIuLi8uLi8uLi8uLi9maWx0ZXItcmVmZXJlbmNlZEZyb20vIn0=