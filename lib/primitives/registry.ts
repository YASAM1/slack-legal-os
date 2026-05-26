import type { z } from 'zod';
import type { PrimitiveTool } from './types';

const registry = new Map<string, PrimitiveTool>();

export function registerPrimitive<TInput extends z.ZodType>(
  tool: PrimitiveTool<TInput>,
): PrimitiveTool<TInput> {
  if (registry.has(tool.name)) {
    throw new Error(`Primitive ${tool.name} is already registered`);
  }
  registry.set(tool.name, tool as PrimitiveTool);
  return tool;
}

export function getPrimitive(name: string): PrimitiveTool | undefined {
  return registry.get(name);
}

export function listPrimitives(): PrimitiveTool[] {
  return [...registry.values()];
}

export function clearRegistry(): void {
  registry.clear();
}
