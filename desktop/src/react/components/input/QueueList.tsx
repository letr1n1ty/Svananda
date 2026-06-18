/**
 * QueueList — 顯示排隊訊息的列表元件
 * 位於輸入框上方，每則訊息一行，右側有「編輯」和「刪除」按鈕。
 */
import { useState, useRef, useEffect } from 'react';
import styles from './InputArea.module.css';

export interface QueuedMessage {
  id: string;
  displayText: string;
  thunk: () => Promise<void>;
}

interface Props {
  items: QueuedMessage[];
  editingId: string | null;
  editingText: string;
  onEdit: (id: string, currentText: string) => void;
  onEditChange: (text: string) => void;
  onEditSave: (id: string) => void;
  onEditCancel: () => void;
  onDelete: (id: string) => void;
}

export function QueueList({
  items, editingId, editingText,
  onEdit, onEditChange, onEditSave, onEditCancel, onDelete,
}: Props) {
  if (items.length === 0) return null;

  return (
    <div className={styles['queue-list']} role="list" aria-label="排隊訊息">
      {items.map((item, idx) => (
        <QueueItem
          key={item.id}
          item={item}
          index={idx}
          total={items.length}
          isEditing={editingId === item.id}
          editingText={editingText}
          onEdit={onEdit}
          onEditChange={onEditChange}
          onEditSave={onEditSave}
          onEditCancel={onEditCancel}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function QueueItem({
  item, index, total, isEditing, editingText,
  onEdit, onEditChange, onEditSave, onEditCancel, onDelete,
}: {
  item: QueuedMessage;
  index: number;
  total: number;
  isEditing: boolean;
  editingText: string;
  onEdit: (id: string, text: string) => void;
  onEditChange: (text: string) => void;
  onEditSave: (id: string) => void;
  onEditCancel: () => void;
  onDelete: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEditSave(item.id); }
    if (e.key === 'Escape') { e.preventDefault(); onEditCancel(); }
  };

  return (
    <div
      className={`${styles['queue-item']}${isEditing ? ` ${styles['queue-item-editing']}` : ''}`}
      role="listitem"
    >
      {/* 序號 */}
      <span className={styles['queue-item-index']} aria-label={`第 ${index + 1} 則，共 ${total} 則`}>
        {index + 1}
      </span>

      {/* 內容區（顯示模式 or 編輯模式） */}
      <div className={styles['queue-item-body']}>
        {isEditing ? (
          <input
            ref={inputRef}
            className={styles['queue-item-input']}
            type="text"
            value={editingText}
            onChange={e => onEditChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="輸入新的訊息內容..."
          />
        ) : (
          <span className={styles['queue-item-text']}>{item.displayText}</span>
        )}
      </div>

      {/* 操作按鈕 */}
      <div className={styles['queue-item-actions']}>
        {isEditing ? (
          <>
            <button
              type="button"
              className={`${styles['queue-action-btn']} ${styles['queue-save-btn']}`}
              title="儲存（Enter）"
              onClick={() => onEditSave(item.id)}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
            <button
              type="button"
              className={`${styles['queue-action-btn']} ${styles['queue-cancel-btn']}`}
              title="取消（Esc）"
              onClick={onEditCancel}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`${styles['queue-action-btn']} ${styles['queue-edit-btn']}`}
              title="編輯排隊訊息"
              onClick={() => onEdit(item.id, item.displayText)}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              type="button"
              className={`${styles['queue-action-btn']} ${styles['queue-delete-btn']}`}
              title="取消此排隊訊息"
              onClick={() => onDelete(item.id)}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
