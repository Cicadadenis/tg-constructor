import fs from "fs";
import { compileGraph } from "../../core/compiler/codegen";

const graph = JSON.parse(
  fs.readFileSync("./examples/simpleGraph.json", "utf-8"),
);

(async () => {
  const result = await compileGraph(graph);

  console.log(result.python);
})();
