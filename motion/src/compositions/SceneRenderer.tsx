import React from 'react';
import { Sequence } from 'remotion';
import type { ReelScript, SceneEntry } from '../schema/reelSchema';
import { MetricCard, MetricWaveBar, Panel, Shell, SignalBars, SignalFlowRow } from './primitives';

function renderScene(scene: SceneEntry): React.ReactNode {
  switch (scene.type) {
    case 'panel':
      return <Panel {...scene.props} />;
    case 'metricCard':
      return <MetricCard {...scene.props} />;
    case 'signalBars':
      return <SignalBars {...scene.props} />;
    case 'signalFlowRow':
      return <SignalFlowRow {...scene.props} />;
    case 'metricWaveBar':
      return <MetricWaveBar {...scene.props} />;
  }
}

interface SceneRendererProps {
  reelScript: ReelScript;
}

export const SceneRenderer: React.FC<SceneRendererProps> = ({ reelScript }) => {
  return (
    <Shell eyebrow={reelScript.eyebrow} title={reelScript.title}>
      {reelScript.scenes.map((scene, index) => (
        <Sequence key={index} from={scene.from} durationInFrames={scene.durationInFrames}>
          {renderScene(scene)}
        </Sequence>
      ))}
    </Shell>
  );
};
