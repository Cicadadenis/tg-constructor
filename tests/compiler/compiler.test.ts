import fs from "fs";
import { compileGraph } from "../../core/compiler/codegen";

const graph = JSON.parse(
  fs.readFileSync("./examples/simpleGraph.json", "utf-8"),
);

const result = compileGraph(graph);

console.log(result.python);
