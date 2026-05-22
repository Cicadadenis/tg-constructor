import { moduleMeta } from './index';

export function generateModule() {
  return {
    ...moduleMeta,
    generatedFrom: 'builtin-module',
  };
}
