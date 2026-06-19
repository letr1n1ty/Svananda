import React, { useState } from 'react';
import { useSettingsStore, type ProviderSummary } from '../../store';
import { hanaFetch } from '../../api';
import { invalidateConfigCache } from '../../../hooks/use-config';
import { t } from '../../helpers';
import { OAuthCredentials } from './OAuthCredentials';
import { ApiKeyCredentials } from './ApiKeyCredentials';
import { ProviderModelList } from './ProviderModelList';
import styles from '../../Settings.module.css';

export function ProviderDetail({ providerId, summary, providerConfig, isPresetSetup, presetInfo, onRefresh }: {
  providerId: string;
  summary: ProviderSummary;
  providerConfig?: Record<string, unknown>;
  isPresetSetup?: boolean;
  presetInfo?: { label: string; value: string; url?: string; api?: string; local?: boolean };
  onRefresh: () => Promise<void>;
}) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(summary.display_name || providerId);
  const showToast = useSettingsStore(s => s.showToast);

  const handleRename = async () => {
    const cleanOld = providerId.trim().toLowerCase();
    const cleanNew = newName.trim().toLowerCase();
    if (!cleanNew) {
      showToast(t('settings.providers.nameRequired'), 'error');
      return;
    }
    if (cleanNew === cleanOld) {
      setIsEditingName(false);
      return;
    }

    const store = useSettingsStore.getState();
    const existingIds = Object.keys(store.providersSummary || {});
    if (existingIds.includes(cleanNew)) {
      showToast(t('settings.providers.nameExists', { name: cleanNew }), 'error');
      return;
    }

    try {
      const res = await hanaFetch('/api/providers/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldId: cleanOld, newId: cleanNew }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      showToast(t('settings.providers.renamed', { to: cleanNew }), 'success');
      invalidateConfigCache();
      setIsEditingName(false);
      useSettingsStore.setState({ selectedProviderId: cleanNew });
      await onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(t('settings.saveFailed') + ': ' + msg, 'error');
    }
  };

  return (
    <div className={styles['pv-detail-inner']}>
      <div className={styles['pv-detail-header']}>
        {isEditingName ? (
          <div className={styles['pv-rename-form']}>
            <input
              type="text"
              className={styles['settings-input']}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  void handleRename();
                } else if (e.key === 'Escape') {
                  setIsEditingName(false);
                  setNewName(summary.display_name || providerId);
                }
              }}
              autoFocus
            />
            <button className={`${styles['pv-rename-btn']} ${styles['primary']}`} onClick={handleRename}>
              {t('settings.api.save') || '儲存'}
            </button>
            <button className={styles['pv-rename-btn']} onClick={() => { setIsEditingName(false); setNewName(summary.display_name || providerId); }}>
              {t('settings.api.cancel') || '取消'}
            </button>
          </div>
        ) : (
          <>
            <h2 className={styles['pv-detail-title']}>
              {summary.display_name || providerId}
              {summary.can_delete && !isPresetSetup && (
                <button
                  className={styles['pv-rename-trigger']}
                  onClick={() => setIsEditingName(true)}
                  title={t('settings.providers.rename') || '重新命名'}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z" />
                  </svg>
                </button>
              )}
            </h2>
            {summary.can_delete && !isPresetSetup && (
              <ProviderDeleteButton providerId={providerId} onRefresh={onRefresh} />
            )}
          </>
        )}
      </div>
      {summary.config_status === 'invalid' && (
        <div className={styles['pv-config-alert']}>
          {t('settings.providers.configInvalid')}
        </div>
      )}
      {summary.config_status === 'needs_setup' && summary.can_delete && !summary.config_error && (
        <div className={styles['pv-config-alert']}>
          {t('settings.providers.configIncomplete')}
        </div>
      )}
      {summary.supports_oauth ? (
        <OAuthCredentials providerId={providerId} summary={summary} onRefresh={onRefresh} />
      ) : (
        <ApiKeyCredentials
          providerId={providerId}
          summary={summary}
          providerConfig={providerConfig}
          isPresetSetup={isPresetSetup}
          presetInfo={presetInfo}
          onRefresh={onRefresh}
        />
      )}
      <ProviderModelList providerId={providerId} summary={summary} onRefresh={onRefresh} />
    </div>
  );
}

function ProviderDeleteButton({ providerId, onRefresh }: { providerId: string; onRefresh: () => Promise<void> }) {
  const showToast = useSettingsStore(s => s.showToast);
  const [confirming, setConfirming] = useState(false);

  const handleDelete = async () => {
    try {
      const res = await hanaFetch('/api/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providers: { [providerId]: null } }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      invalidateConfigCache();
      showToast(t('settings.providers.deleted', { name: providerId }), 'success');
      useSettingsStore.setState({ selectedProviderId: null });
      setConfirming(false);
      await onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(t('settings.saveFailed') + ': ' + msg, 'error');
    }
  };

  return (
    <>
      <button className={styles['pv-delete-btn']} onClick={() => setConfirming(true)}>
        {t('settings.providers.delete')}
      </button>
      {confirming && (
        <>
          <div className={styles['pv-model-edit-overlay']} onClick={() => setConfirming(false)} />
          <div className={styles['pv-confirm-dialog']}>
            <p className={styles['pv-confirm-text']}>
              {t('settings.providers.deleteConfirm', { name: providerId })}
            </p>
            <div className={styles['pv-confirm-actions']}>
              <button className={styles['pv-add-form-btn']} onClick={() => setConfirming(false)}>{t('settings.api.cancel')}</button>
              <button className={`${styles['pv-add-form-btn']} ${styles['danger']}`} onClick={handleDelete}>{t('settings.providers.delete')}</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
