export function normalizeAst(ast: any) {
  return {
    ...ast,
    normalized: true,
  };
}
