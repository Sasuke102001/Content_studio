import { z } from 'zod';

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a 6-digit hex color (e.g. #7C3AED)');

export const accentSchema = z.enum(['violet', 'gold']);

export const panelPropsSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  start: z.number().int().min(0),
  accent: accentSchema.optional(),
  title: z.string().optional(),
  body: z.string().optional(),
});

export const metricCardPropsSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  start: z.number().int().min(0),
  label: z.string(),
  value: z.string(),
  accent: accentSchema.optional(),
});

export const signalBarsPropsSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  start: z.number().int().min(0),
  color: hexColorSchema,
  values: z.array(z.number().min(0).max(100)).min(3).max(12),
});

export const signalFlowRowPropsSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  start: z.number().int().min(0),
  color: hexColorSchema,
  label: z.string(),
  frameOffset: z.number().int().min(0).optional(),
});

export const metricWaveBarPropsSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  start: z.number().int().min(0),
  color: hexColorSchema,
  value: z.number().min(0).max(100),
  index: z.number().int().min(0),
});

const sceneTiming = {
  from: z.number().int().min(0),
  durationInFrames: z.number().int().min(1),
};

export const sceneEntrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('panel'), ...sceneTiming, props: panelPropsSchema }),
  z.object({ type: z.literal('metricCard'), ...sceneTiming, props: metricCardPropsSchema }),
  z.object({ type: z.literal('signalBars'), ...sceneTiming, props: signalBarsPropsSchema }),
  z.object({ type: z.literal('signalFlowRow'), ...sceneTiming, props: signalFlowRowPropsSchema }),
  z.object({ type: z.literal('metricWaveBar'), ...sceneTiming, props: metricWaveBarPropsSchema }),
]);

export const reelScriptSchema = z.object({
  title: z.string().min(1),
  eyebrow: z.string().optional(),
  fps: z.literal(30),
  width: z.literal(1080),
  height: z.literal(1920),
  durationInFrames: z.number().int().min(150).max(600),
  scenes: z.array(sceneEntrySchema).min(1).max(40),
});

export type SceneEntry = z.infer<typeof sceneEntrySchema>;
export type ReelScript = z.infer<typeof reelScriptSchema>;
