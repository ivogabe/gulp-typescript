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

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9pdm9nYWJlL0RvY3VtZW50cy9XZWJzaXRlcy9ndWxwLXR5cGVzY3JpcHQtaW5jcmVtZW50YWwvYS50cyIsIi9Vc2Vycy9pdm9nYWJlL0RvY3VtZW50cy9XZWJzaXRlcy9ndWxwLXR5cGVzY3JpcHQtaW5jcmVtZW50YWwvaW1wbGljaXRSZWZlcmVuY2VkLnRzIiwiL1VzZXJzL2l2b2dhYmUvRG9jdW1lbnRzL1dlYnNpdGVzL2d1bHAtdHlwZXNjcmlwdC1pbmNyZW1lbnRhbC96LnRzIiwiL1VzZXJzL2l2b2dhYmUvRG9jdW1lbnRzL1dlYnNpdGVzL2d1bHAtdHlwZXNjcmlwdC1pbmNyZW1lbnRhbC90ZXN0LTEudHMiXSwibmFtZXMiOlsiQ2xhc3NBIiwiQ2xhc3NBLmNvbnN0cnVjdG9yIiwiQ2xhc3NBLmZvbyIsIk1vZCIsIk1vZC5mb28iLCJDbGFzc1oiLCJDbGFzc1ouY29uc3RydWN0b3IiLCJDbGFzc1ouYmFyIiwiTW9kLmxvcmVtIiwiVGVzdENsYXNzIiwiVGVzdENsYXNzLmNvbnN0cnVjdG9yIiwiTW9kLmJhciJdLCJtYXBwaW5ncyI6IkFBQUEsSUFBTSxNQUFNO0lBQVpBLFNBQU1BLE1BQU1BO0lBSVpDLENBQUNBO0lBSEFELG9CQUFHQSxHQUFIQTtJQUVBRSxDQUFDQTtJQUNGRixhQUFDQTtBQUFEQSxDQUpBLEFBSUNBLElBQUE7QUFFRCxJQUFPLEdBQUcsQ0FFVDtBQUZELFdBQU8sR0FBRyxFQUFDLENBQUM7SUFDWEcsU0FBZ0JBLEdBQUdBO0lBQUlDLENBQUNBO0lBQVJELE9BQUdBLEdBQUhBLEdBQVFBLENBQUFBO0FBQ3pCQSxDQUFDQSxFQUZNLEdBQUcsS0FBSCxHQUFHLFFBRVQ7O0FDUkQsSUFBSSxrQkFBa0IsR0FBRyxxQkFBcUIsQ0FBQzs7Ozs7Ozs7QUNBL0MsQUFFQSw2QkFGNkI7QUFDN0IsOENBQThDO0lBQ3hDLE1BQU07SUFBU0UsVUFBZkEsTUFBTUEsVUFBZUE7SUFBM0JBLFNBQU1BLE1BQU1BO1FBQVNDLDhCQUFNQTtJQUkzQkEsQ0FBQ0E7SUFIQUQsb0JBQUdBLEdBQUhBO0lBRUFFLENBQUNBO0lBQ0ZGLGFBQUNBO0FBQURBLENBSkEsQUFJQ0EsRUFKb0IsTUFBTSxFQUkxQjtBQUVELElBQU8sR0FBRyxDQUVUO0FBRkQsV0FBTyxHQUFHLEVBQUMsQ0FBQztJQUNYRixTQUFnQkEsS0FBS0E7SUFBSUssQ0FBQ0E7SUFBVkwsU0FBS0EsR0FBTEEsS0FBVUEsQ0FBQUE7QUFDM0JBLENBQUNBLEVBRk0sR0FBRyxLQUFILEdBQUcsUUFFVDs7QUNWRCw2QkFBNkI7QUFDN0IsNkJBQTZCO0FBRTdCLElBQU0sU0FBUztJQUFmTSxTQUFNQSxTQUFTQTtJQUVmQyxDQUFDQTtJQUFERCxnQkFBQ0E7QUFBREEsQ0FGQSxBQUVDQSxJQUFBO0FBRUQsSUFBSSxDQUFDLEdBQUcsSUFBSSxTQUFTLEVBQUUsQ0FBQztBQUV4QixPQUFPLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxJQUFJLE1BQU0sRUFBRSxFQUFFLElBQUksTUFBTSxFQUFFLENBQUMsQ0FBQztBQUUzQyxJQUFPLEdBQUcsQ0FFVDtBQUZELFdBQU8sR0FBRyxFQUFDLENBQUM7SUFDWE4sU0FBZ0JBLEdBQUdBO0lBQUlRLENBQUNBO0lBQVJSLE9BQUdBLEdBQUhBLEdBQVFBLENBQUFBO0FBQ3pCQSxDQUFDQSxFQUZNLEdBQUcsS0FBSCxHQUFHLFFBRVQiLCJmaWxlIjoiY29uY2F0LmpzIiwic291cmNlUm9vdCI6Ii4uLy4uLy4uL2ZpbHRlci1yZWZlcmVuY2VkRnJvbS8ifQ==