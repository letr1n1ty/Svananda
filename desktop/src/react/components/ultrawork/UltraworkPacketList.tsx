import React from 'react';
import type { UltraworkWorkPacket } from '../../types';
import css from './UltraworkPanel.module.css';

interface UltraworkPacketListProps {
  packets: UltraworkWorkPacket[];
}

export function UltraworkPacketList({ packets }: UltraworkPacketListProps) {
  if (packets.length === 0) {
    return <div className={css.cardDescription}>No work packets generated for this run.</div>;
  }

  return (
    <div className={css.tabContent}>
      {packets.map((packet) => {
        const isCoding = packet.kind === 'coding';
        return (
          <div key={packet.id} className={css.packetCard}>
            <div className={css.packetHeader}>
              <span>{packet.kind}:{packet.id}</span>
              <span className={css.packetAgent}>{packet.agent}</span>
            </div>
            <div className={css.packetObjective}>
              <strong>Objective:</strong> {packet.objective || packet.title}
            </div>
            {packet.deliverables && packet.deliverables.length > 0 && (
              <div>
                <strong>Deliverables:</strong>
                <ul className={css.packetDeliverables}>
                  {packet.deliverables.map((d, idx) => <li key={idx}>{d}</li>)}
                </ul>
              </div>
            )}
            {isCoding && (
              <div className={css.packetGuard}>
                ⚠️ Skeleton runner: does not mutate files or execute external tools.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
