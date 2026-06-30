import React from 'react';
import type { UltraworkArtifact } from '../../types';
import css from './UltraworkPanel.module.css';

interface UltraworkArtifactListProps {
  artifacts: UltraworkArtifact[];
}

export function UltraworkArtifactList({ artifacts }: UltraworkArtifactListProps) {
  if (artifacts.length === 0) {
    return <div className={css.cardDescription}>No artifacts created for this run.</div>;
  }

  return (
    <div className={css.tabContent}>
      {artifacts.map((artifact) => {
        const isExported = !!(artifact.exportedFile?.fileId || artifact.exportedFile?.filePath);
        return (
          <div key={artifact.id} className={css.artifactCard}>
            <div>
              <div className={css.artifactTitle}>{artifact.title}</div>
              <div className={css.artifactMeta}>
                {artifact.kind} · {artifact.agent || 'planner'}
              </div>
            </div>
            <span className={`${css.artifactExportBadge} ${isExported ? css.artifactExportBadgeActive : ''}`}>
              {isExported ? 'exported' : 'pending export'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
