var ClassA = (function () {
    function ClassA() {
    }
    ClassA.prototype.foo = function () {
    };
    return ClassA;
})();
var Mod;
(function (Mod) {
    function foo() { }
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
    function lorem() { }
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
    function bar() { }
    Mod.bar = bar;
})(Mod || (Mod = {}));

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImEudHMiLCJpbXBsaWNpdFJlZmVyZW5jZWQudHMiLCJ6LnRzIiwidGVzdC0xLnRzIl0sIm5hbWVzIjpbIkNsYXNzQSIsIkNsYXNzQS5jb25zdHJ1Y3RvciIsIk1vZCIsIkNsYXNzWiIsIkNsYXNzWi5jb25zdHJ1Y3RvciIsIlRlc3RDbGFzcyIsIlRlc3RDbGFzcy5jb25zdHJ1Y3RvciJdLCJtYXBwaW5ncyI6IkFBQUEsSUFBTSxNQUFNO0lBQVpBLFNBQU1BLE1BQU1BO0lBSVpDLENBQUNBO0lBSEFELG9CQUFHQSxHQUFIQTtJQUVBQSxDQUFDQTtJQUNGQSxhQUFDQTtBQUFEQSxDQUpBLEFBSUNBLElBQUE7QUFFRCxJQUFPLEdBQUcsQ0FFVDtBQUZELFdBQU8sR0FBRyxFQUFDLENBQUM7SUFDWEUsU0FBZ0JBLEdBQUdBLEtBQUlBLENBQUNBO0lBQVJBLE9BQUdBLEdBQUhBLEdBQVFBLENBQUFBO0FBQ3pCQSxDQUFDQSxFQUZNLEdBQUcsS0FBSCxHQUFHLFFBRVQ7O0FDUkQsSUFBSSxrQkFBa0IsR0FBRyxxQkFBcUIsQ0FBQzs7Ozs7Ozs7QUNBL0MsQUFFQSw2QkFGNkI7QUFDN0IsOENBQThDO0lBQ3hDLE1BQU07SUFBU0MsVUFBZkEsTUFBTUEsVUFBZUE7SUFBM0JBLFNBQU1BLE1BQU1BO1FBQVNDLDhCQUFNQTtJQUkzQkEsQ0FBQ0E7SUFIQUQsb0JBQUdBLEdBQUhBO0lBRUFBLENBQUNBO0lBQ0ZBLGFBQUNBO0FBQURBLENBSkEsQUFJQ0EsRUFKb0IsTUFBTSxFQUkxQjtBQUVELElBQU8sR0FBRyxDQUVUO0FBRkQsV0FBTyxHQUFHLEVBQUMsQ0FBQztJQUNYRCxTQUFnQkEsS0FBS0EsS0FBSUEsQ0FBQ0E7SUFBVkEsU0FBS0EsR0FBTEEsS0FBVUEsQ0FBQUE7QUFDM0JBLENBQUNBLEVBRk0sR0FBRyxLQUFILEdBQUcsUUFFVDs7QUNWRCw2QkFBNkI7QUFDN0IsNkJBQTZCO0FBRTdCLElBQU0sU0FBUztJQUFmRyxTQUFNQSxTQUFTQTtJQUVmQyxDQUFDQTtJQUFERCxnQkFBQ0E7QUFBREEsQ0FGQSxBQUVDQSxJQUFBO0FBRUQsSUFBSSxDQUFDLEdBQUcsSUFBSSxTQUFTLEVBQUUsQ0FBQztBQUV4QixPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLE1BQU0sRUFBRSxFQUFFLElBQUksTUFBTSxFQUFFLENBQUMsQ0FBQztBQUUzQyxJQUFPLEdBQUcsQ0FFVDtBQUZELFdBQU8sR0FBRyxFQUFDLENBQUM7SUFDWEgsU0FBZ0JBLEdBQUdBLEtBQUlBLENBQUNBO0lBQVJBLE9BQUdBLEdBQUhBLEdBQVFBLENBQUFBO0FBQ3pCQSxDQUFDQSxFQUZNLEdBQUcsS0FBSCxHQUFHLFFBRVQiLCJmaWxlIjoiY29uY2F0LmpzIiwic291cmNlUm9vdCI6Ii4uLy4uLy4uLy4uL2ZpbHRlci1yZWZlcmVuY2VkRnJvbS8ifQ==