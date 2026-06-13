import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { SceneRenderer } from './compositions/SceneRenderer';
import { reelScriptSchema, type ReelScript } from './schema/reelSchema';

const defaultReelScript: ReelScript = {
  title: 'Sample Reel',
  eyebrow: 'DEMO',
  fps: 30,
  width: 1080,
  height: 1920,
  durationInFrames: 150,
  scenes: [
    {
      type: 'panel',
      from: 0,
      durationInFrames: 150,
      props: {
        x: 0,
        y: 0,
        w: 988,
        h: 400,
        start: 0,
        accent: 'violet',
        title: 'Sample Panel',
        body: 'Replace this default composition by rendering a Kimi-generated reel script.',
      },
    },
  ],
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="SceneRenderer"
      component={SceneRenderer}
      fps={30}
      width={1080}
      height={1920}
      durationInFrames={defaultReelScript.durationInFrames}
      defaultProps={{ reelScript: defaultReelScript }}
      calculateMetadata={async ({ props }) => {
        const reelScript = reelScriptSchema.parse(props.reelScript);
        return { durationInFrames: reelScript.durationInFrames };
      }}
    />
  );
};

registerRoot(RemotionRoot);
