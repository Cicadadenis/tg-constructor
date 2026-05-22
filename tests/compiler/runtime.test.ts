import fs from "fs";

import { compileGraph } from "../../core/compiler/codegen";

const graph = JSON.parse(
  fs.readFileSync("./examples/runtimeGraph.json", "utf-8"),
);

(async () => {
  const result = await compileGraph(graph);

  console.log(result.runtime);

  console.log(result.python);
})();
