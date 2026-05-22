export interface CompilerPlugin {
  name: string;
  register(): void;
}
