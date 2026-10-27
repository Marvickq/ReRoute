// Lets `node --test` load the extensionless relative TypeScript imports used in src/lib (type stripping only).
import { register } from "node:module";
register("./ts-resolve.mjs", import.meta.url);
