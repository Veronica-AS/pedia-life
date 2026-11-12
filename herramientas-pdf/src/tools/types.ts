import type { ToolDef } from './registry';

export interface ToolProps {
  tool: ToolDef;
  preset?: Record<string, string>;
}
