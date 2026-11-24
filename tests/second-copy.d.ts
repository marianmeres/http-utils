// `import("../src/error.ts?copy=2")` in problem.test.ts: a query string makes the
// loader evaluate the file a second time, which is how the tests get a second,
// independent copy of the package's classes. tsc resolves no file for such a
// specifier, so it is declared here (untyped; the test casts it to the real module).
declare module "*?copy=2";
