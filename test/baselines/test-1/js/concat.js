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



//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uY2F0LmpzIiwic291cmNlcyI6WyIvVXNlcnMvaXZvZ2FiZS9Eb2N1bWVudHMvV2Vic2l0ZXMvZ3VscC10eXBlc2NyaXB0LWluY3JlbWVudGFsL2EudHMiLCIvVXNlcnMvaXZvZ2FiZS9Eb2N1bWVudHMvV2Vic2l0ZXMvZ3VscC10eXBlc2NyaXB0LWluY3JlbWVudGFsL2ltcGxpY2l0UmVmZXJlbmNlZC50cyIsIi9Vc2Vycy9pdm9nYWJlL0RvY3VtZW50cy9XZWJzaXRlcy9ndWxwLXR5cGVzY3JpcHQtaW5jcmVtZW50YWwvei50cyIsIi9Vc2Vycy9pdm9nYWJlL0RvY3VtZW50cy9XZWJzaXRlcy9ndWxwLXR5cGVzY3JpcHQtaW5jcmVtZW50YWwvdGVzdC0xLnRzIl0sIm5hbWVzIjpbIkNsYXNzQSIsIkNsYXNzQS5jb25zdHJ1Y3RvciIsIkNsYXNzQS5mb28iLCJNb2QiLCJNb2QuZm9vIiwiQ2xhc3NaIiwiQ2xhc3NaLmNvbnN0cnVjdG9yIiwiQ2xhc3NaLmJhciIsIk1vZC5sb3JlbSIsIlRlc3RDbGFzcyIsIlRlc3RDbGFzcy5jb25zdHJ1Y3RvciIsIk1vZC5iYXIiXSwibWFwcGluZ3MiOiJBQUFBLElBQU0sTUFBTTtJQUFaQSxTQUFNQSxNQUFNQTtJQUlaQyxDQUFDQTtJQUhBRCxvQkFBR0EsR0FBSEE7SUFFQUUsQ0FBQ0E7SUFDRkYsYUFBQ0E7QUFBREEsQ0FBQ0EsSUFBQTtBQUVELElBQU8sR0FBRyxDQUVUO0FBRkQsV0FBTyxHQUFHLEVBQUMsQ0FBQztJQUNYRyxTQUFnQkEsR0FBR0E7SUFBSUMsQ0FBQ0E7SUFBUkQsT0FBR0EsR0FBSEEsR0FBUUE7QUFDekJBLENBQUNBLEVBRk0sR0FBRyxLQUFILEdBQUcsUUFFVDs7O0FDUkQsSUFBSSxrQkFBa0IsR0FBRyxxQkFBcUIsQ0FBQzs7Ozs7Ozs7O0FDRS9DLDZCQUY2QjtBQUM3Qiw4Q0FBOEM7SUFDeEMsTUFBTTtJQUFTRSxVQUFmQSxNQUFNQSxVQUFlQTtJQUEzQkEsU0FBTUEsTUFBTUE7UUFBU0MsOEJBQU1BO0lBSTNCQSxDQUFDQTtJQUhBRCxvQkFBR0EsR0FBSEE7SUFFQUUsQ0FBQ0E7SUFDRkYsYUFBQ0E7QUFBREEsQ0FBQ0EsRUFKb0IsTUFBTSxFQUkxQjtBQUVELElBQU8sR0FBRyxDQUVUO0FBRkQsV0FBTyxHQUFHLEVBQUMsQ0FBQztJQUNYRixTQUFnQkEsS0FBS0E7SUFBSUssQ0FBQ0E7SUFBVkwsU0FBS0EsR0FBTEEsS0FBVUE7QUFDM0JBLENBQUNBLEVBRk0sR0FBRyxLQUFILEdBQUcsUUFFVDs7O0FDVkQsNkJBQTZCO0FBQzdCLDZCQUE2QjtBQUU3QixJQUFNLFNBQVM7SUFBZk0sU0FBTUEsU0FBU0E7SUFFZkMsQ0FBQ0E7SUFBREQsZ0JBQUNBO0FBQURBLENBQUNBLElBQUE7QUFFRCxJQUFJLENBQUMsR0FBRyxJQUFJLFNBQVMsRUFBRSxDQUFDO0FBRXhCLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFLElBQUksTUFBTSxFQUFFLEVBQUUsSUFBSSxNQUFNLEVBQUUsQ0FBQyxDQUFDO0FBRTNDLElBQU8sR0FBRyxDQUVUO0FBRkQsV0FBTyxHQUFHLEVBQUMsQ0FBQztJQUNYTixTQUFnQkEsR0FBR0E7SUFBSVEsQ0FBQ0E7SUFBUlIsT0FBR0EsR0FBSEEsR0FBUUE7QUFDekJBLENBQUNBLEVBRk0sR0FBRyxLQUFILEdBQUcsUUFFVCIsInNvdXJjZVJvb3QiOiIuLi8uLi8uLi90ZXN0LTEvIn0=