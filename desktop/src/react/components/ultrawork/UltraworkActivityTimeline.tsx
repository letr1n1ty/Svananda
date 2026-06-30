import React from 'react';
import type { UltraworkRunSummary } from '../../types';
import css from './UltraworkPanel.module.css';

interface UltraworkActivityTimelineProps {
  run: UltraworkRunSummary;
}

export function UltraworkActivityTimeline({ run }: UltraworkActivityTimelineProps) {
  const packets = run.workPackets || [];
  if (packets.length === 0) {
    return <div className={css.cardDescription}>No activity history recorded.</div>;
  }

  return (
    <div className={css.tabContent}>
      {packets.map((packet) => {
        const isDone = packet.status === 'completed';
        const isRunning = packet.status === 'running';
        const isFailed = packet.status === 'failed';

        let nodeClass = css.timelineNode;
        if (isDone) nodeClass += ` ${css.timelineNodeDone}`;
        else if (isRunning) nodeClass += ` ${css.timelineNodeRunning}`;
        else if (isFailed) nodeClass += ` ${css.timelineNodeFailed}`;

        return (
          <div key={packet.id} className={css.timelineRow}>
            <div className={nodeClass} />
            <div className={css.timelineContent}>
              <div className={css.timelineTitle}>{packet.title || `${packet.kind}:${packet.id}`}</div>
              <div className={css.timelineMeta}>
                Agent: {packet.agent} · Status: {packet.status}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
