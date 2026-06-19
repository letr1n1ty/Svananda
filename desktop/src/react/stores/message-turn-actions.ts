import { useStore } from './index';
import { sessionScopedListIncludes } from './session-slice';
import type { ChatMessage } from './chat-types';
import { hanaFetch } from '../hooks/use-hana-fetch';
import { collectUiContext } from '../utils/ui-context';

export async function replayLatestUserMessage(
  sessionPath: string,
  message: ChatMessage,
  replacementText?: string,
): Promise<boolean> {
  if (!sessionPath || !message?.id) return false;

  try {
    const state = useStore.getState();
    if (sessionScopedListIncludes(state, state.streamingSessions, sessionPath)) return false;

    await hanaFetch('/api/sessions/latest-user-message/replay', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        path: sessionPath,
        sourceEntryId: message.sourceEntryId || null,
        clientMessageId: message.id,
        text: replacementText,
        uiContext: collectUiContext(state),
        displayMessage: {
          text: replacementText ?? message.text ?? '',
          quotedText: message.quotedText,
          attachments: message.attachments,
          skills: message.skills,
          deskContext: message.deskContext ?? null,
        },
      }),
    });
    return true;
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    useStore.getState().setInlineError?.(sessionPath, text, 6000);
    return false;
  }
}

export async function branchFromMessage(
  sessionPath: string,
  message: ChatMessage,
): Promise<boolean> {
  if (!sessionPath || !message?.sourceEntryId) return false;

  try {
    const state = useStore.getState();
    if (state.streamingSessions.includes(sessionPath)) return false;

    const res = await hanaFetch('/api/sessions/branch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        path: sessionPath,
        sourceEntryId: message.sourceEntryId,
        clientMessageId: message.id,
      }),
    });
    const data = await res.json();

    const { switchSession, loadSessions } = await import('./session-actions');
    await loadSessions();
    await switchSession(data.path);

    useStore.getState().requestInputFocus?.();
    return true;
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    useStore.getState().setInlineError?.(sessionPath, text, 6000);
    return false;
  }
}

