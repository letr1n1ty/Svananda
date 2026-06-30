import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Helper to run shell commands
function runCmd(cmd) {
  try {
    return execSync(cmd, { cwd: projectRoot, encoding: 'utf-8' });
  } catch (err) {
    console.error(`Command failed: ${cmd}`);
    console.error(err.stdout || err.message);
    throw err;
  }
}

// Deep merge two objects
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// Helper to replace branding terms, preserving openhanako repo URL
function rebrandText(text) {
  if (typeof text !== 'string') return text;
  
  const urls = [];
  let res = text;
  
  // Mask repo URLs
  res = res.replace(/https:\/\/github\.com\/liliMozi\/openhanako/g, (match) => {
    urls.push(match);
    return `__GIT_URL_PLACEHOLDER_${urls.length - 1}__`;
  });
  res = res.replace(/liliMozi\/openhanako/g, (match) => {
    urls.push(match);
    return `__GIT_URL_PLACEHOLDER_${urls.length - 1}__`;
  });

  // Apply rebranding replacements
  res = res.replace(/HanaAgent/g, 'Svananda');
  res = res.replace(/hanako-dev/g, 'svananda-dev');
  res = res.replace(/Hanako-dev/g, 'Svananda-dev');
  res = res.replace(/Hanako/g, 'Svananda');
  res = res.replace(/hanako/g, 'svananda');
  res = res.replace(/\.hanako/g, '.svananda');
  res = res.replace(/com\.hanako\.app/g, 'com.svananda.app');

  // Restore repo URLs
  for (let i = 0; i < urls.length; i++) {
    res = res.replace(`__GIT_URL_PLACEHOLDER_${i}__`, urls[i]);
  }
  return res;
}

function rebrandValue(val) {
  if (typeof val === 'string') {
    return rebrandText(val);
  } else if (Array.isArray(val)) {
    return val.map(rebrandValue);
  } else if (val !== null && typeof val === 'object') {
    const res = {};
    for (const key of Object.keys(val)) {
      res[key] = rebrandValue(val[key]);
    }
    return res;
  }
  return val;
}

// Line-by-line conflict block resolver
function resolveConflictBlocks(filename, content) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const result = [];
  let i = 0;
  let inConflict = false;
  let localLines = [];
  let upstreamLines = [];
  let markerStage = 0; // 1: <<<<<<<, 2: =======, 3: >>>>>>>

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('<<<<<<<')) {
      inConflict = true;
      markerStage = 1;
      localLines = [];
      upstreamLines = [];
      i++;
    } else if (line.startsWith('=======')) {
      markerStage = 2;
      i++;
    } else if (line.startsWith('>>>>>>>')) {
      inConflict = false;
      markerStage = 3;
      
      const resolved = resolveBlock(filename, localLines, upstreamLines);
      result.push(...resolved);
      i++;
    } else {
      if (inConflict) {
        if (markerStage === 1) {
          localLines.push(line);
        } else if (markerStage === 2) {
          upstreamLines.push(line);
        }
      } else {
        result.push(line);
      }
      i++;
    }
  }
  return result.join('\n');
}

function resolveBlock(filename, localLines, upstreamLines) {
  const localStr = localLines.join('\n').trim();
  const upstreamStr = upstreamLines.join('\n').trim();

  // Rule 1: If rebranding is the only difference
  if (rebrandText(upstreamStr) === localStr) {
    return localLines;
  }

  // Rule 2: core/agent.ts imports
  if (filename === 'core/agent.ts') {
    if (localStr.includes('loadSvanandaPersona') && upstreamStr.includes('createCardGuideTool')) {
      return [
        'import { loadSvanandaPersona } from "./agent-svananda-persona.ts";',
        'import { buildSvanandaConsolidatedMemory } from "./agent-svananda-memory.ts";',
        'import { createCardGuideTool } from "../lib/tools/card-guide-tool.ts";',
        'import { createShowCardTool } from "../lib/tools/show-card-tool.ts";'
      ];
    }
  }

  // Rule 3: InterfaceTab.tsx helpers
  if (filename.endsWith('InterfaceTab.tsx')) {
    if (localStr.includes('BUILTIN_STYLED_THEMES') && upstreamStr.includes('BODY_FONT_SIZE_OFFSETS')) {
      return [
        '// 「內建樣式」主題：ID 不含 opencode- 前綴的原始主題，以及 auto 選項',
        '// 這些主題背景由 CSS 定義，無需 registry backgroundColor hex 色塊',
        'const BUILTIN_STYLED_THEMES = new Set<string>([',
        "  ...registry.getThemeIds().filter((id: string) => !id.startsWith('opencode-')),",
        "  'auto',",
        ']);',
        '',
        'function getContrastColor(hexColor?: string): string {',
        "  if (!hexColor) return '#1a1a1a';",
        "  const hex = hexColor.replace('#', '');",
        '  const r = parseInt(hex.substring(0, 2), 16);',
        '  const g = parseInt(hex.substring(2, 4), 16);',
        '  const b = parseInt(hex.substring(4, 6), 16);',
        '  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;',
        "  return (yiq >= 128) ? '#1a1a1a' : '#eeeeee';",
        '}',
        '',
        'const BODY_FONT_SIZE_OFFSETS = [-2, -1, 0, 1, 2] as const;',
        '',
        'const CONTENT_WIDTH_STEPS: Array<{',
        '  value: string;',
        '  width: ReadingContentWidth;',
        '  labelKey?: string;',
        '}> = [',
        "  { value: '640', width: 640 },",
        "  { value: '720', width: 720 },",
        "  { value: '800', width: 800 },",
        "  { value: 'unlimited', width: 'unlimited', labelKey: 'settings.appearance.readingWidthUnlimited' },",
        '];',
        '',
        'function formatBodyFontSizeOffset(offset: number): string {',
        '  return offset > 0 ? `+${offset}` : String(offset);',
        '}'
      ];
    }
  }

  // Rule 4: theme-registry.test.ts
  if (filename.endsWith('theme-registry.test.ts')) {
    if (localStr.includes('至少含 10 個原始自訂主題') && upstreamStr.includes('恰好 11 条')) {
      return [
        "    // 原始 11 個自訂主題，包含上游新增的 coral（上游合併後主題總數大幅增加，但這些必須保留）",
        "    const ORIGINAL_THEMES = [",
        "      'absolutely', 'contemplation', 'coral', 'deep-think',",
        "      'delve', 'grass-aroma', 'high-contrast', 'midnight', 'midnight-contrast',",
        "      'new-warm-paper', 'warm-paper',",
        "    ];",
        "",
        "    it('至少含 11 個自訂主題', () => {",
        "      expect(Object.keys(reg.THEMES).length).toBeGreaterThanOrEqual(11);",
        "    });",
        "",
        "    it('包含所有自訂主題 id', () => {",
        "      const ids = Object.keys(reg.THEMES);",
        "      for (const id of ORIGINAL_THEMES) {",
        "        expect(ids, `缺少原始主題: ${id}`).toContain(id);",
        "      }",
        "    });"
      ];
    }
    if (localStr.includes('getAllUIOptions 含所有主题 + auto') && upstreamStr.includes('getAllUIOptions 含 11 个主题 + auto')) {
      return [
        "    it('getAllUIOptions 含所有主题 + auto', () => {",
        "      const opts = reg.getAllUIOptions();",
        "      // 上游合併後主題數量動態成長，這裡驗證結構而非硬編碼數量",
        "      const themeCount = reg.getThemeIds().length;",
        "      expect(opts).toHaveLength(themeCount + 1); // themes + auto option"
      ];
    }
  }

  // Rule 5: UserMessage.tsx footer actions
  if (filename.endsWith('UserMessage.tsx')) {
    if (localStr.includes('branchAction') && upstreamStr.includes('footerActions = editing ? editingActions : latestActions')) {
      return [
        "  ] : [], [busy, canShowLatestActions, handleEdit, handleRegenerate, isStreaming, t]);",
        "  const branchAction: MessageFooterAction[] = useMemo(() => (",
        "    !readOnly && !!message.sourceEntryId && !editing ? [{",
        "      id: 'branch',",
        "      title: t('chat.branchFromHere'),",
        "      icon: <BranchIcon />,",
        "      onClick: () => { void handleBranch(); },",
        "      disabled: isStreaming || busy || branching,",
        "      active: branching,",
        "    }] : []",
        "  ), [branching, busy, editing, handleBranch, isStreaming, message.sourceEntryId, readOnly, t]);",
        "  const footerActions = editing ? editingActions : [...latestActions, ...branchAction];"
      ];
    }
  }

  // Rule 6: AssistantMessage.tsx
  if (filename.endsWith('AssistantMessage.tsx')) {
    // Block 1: imports
    if (localStr === '' && upstreamStr.includes('InteractiveCard')) {
      return [
        "import { InteractiveCard } from './InteractiveCard';",
        "import { useMessageFooterActions } from './MessageActions';"
      ];
    }
    // Block 2: Logic
    if (localStr.includes('branching') && upstreamStr.includes('useMessageFooterActions')) {
      return [
        "  const [branching, setBranching] = useState(false);",
        "  const handleBranch = useCallback(async () => {",
        "    if (branching || isStreaming || !message.sourceEntryId) return;",
        "    setBranching(true);",
        "    try {",
        "      await branchFromMessage(sessionPath, message);",
        "    } finally {",
        "      setBranching(false);",
        "    }",
        "  }, [branching, isStreaming, message, sessionPath]);",
        "",
        "  const canShowRegenerateAction = !readOnly && showTurnCompletionTime && isLatestAssistantMessage && !!retrySourceMessage && !isStreaming;",
        "  const shouldPersistCompletionTime = showTurnCompletionTime && isLatestAssistantMessage && !isStreaming;",
        "  const timeText = showTurnCompletionTime && !isStreaming ? formatMessageTime(message.timestamp) : null;",
        "  const standardMessageActions = useMessageFooterActions({",
        "    messageId: message.id,",
        "    selectionIds: assistantTurnSelectionIds,",
        "    sessionPath,",
        "    onCopy: handleCopy,",
        "    onScreenshot: () => { void handleScreenshot(); },",
        "    copied,",
        "    isStreaming,",
        "  });",
        "  const messageActions = readOnly || !showTurnCompletionTime || isStreaming ? [] : standardMessageActions;",
        "",
        "  const footerActions = useMemo(() => {",
        "    const actions: MessageFooterAction[] = [];",
        "    if (canShowRegenerateAction) {",
        "      actions.push({",
        "        id: 'regenerate',",
        "        title: t('common.regenerate'),",
        "        icon: <RegenerateIcon />,",
        "        onClick: () => { void handleRegenerate(); },",
        "        disabled: retrying || isStreaming,",
        "      });",
        "    }",
        "    if (!readOnly && !!message.sourceEntryId && !isInterludeOnly) {",
        "      actions.push({",
        "        id: 'branch',",
        "        title: t('chat.branchFromHere'),",
        "        icon: <BranchIcon />,",
        "        onClick: () => { void handleBranch(); },",
        "        disabled: branching || isStreaming,",
        "        active: branching,",
        "      });",
        "    }",
        "    return actions;",
        "  }, [branching, canShowRegenerateAction, handleBranch, handleRegenerate, isInterludeOnly, isStreaming, message.sourceEntryId, readOnly, retrying, t]);"
      ];
    }
    // Block 3: Render
    if (localStr.includes('assistantFooterContainer') && upstreamStr.includes('MessageFooterActions')) {
      return [
        "      {!isInterludeOnly && (timeText || footerActions.length > 0 || messageActions.length > 0) && (",
        "        <MessageFooterActions",
        '          align="left"',
        "          timeText={timeText}",
        "          timePersistent={shouldPersistCompletionTime}",
        "          leadingActions={footerActions}",
        "          actions={messageActions}",
        '          testId="assistant-completion-actions"',
        "        />",
        "      )}"
      ];
    }
  }

  // Fallback: keep local side but warn
  console.warn(`[Warning] Unresolved block in ${filename}, using HEAD (local) side.`);
  return localLines;
}

// Conflict Resolvers map
const conflictResolvers = {
  'desktop/src/shared/theme-registry-data.json': () => {
    console.log('Resolving theme-registry-data.json...');
    const localContent = JSON.parse(runCmd('git show HEAD:desktop/src/shared/theme-registry-data.json'));
    const upstreamContent = JSON.parse(runCmd('git show MERGE_HEAD:desktop/src/shared/theme-registry-data.json'));
    
    const merged = JSON.parse(JSON.stringify(upstreamContent));
    merged.themes = Object.assign({}, upstreamContent.themes, localContent.themes);
    fs.writeFileSync(
      path.join(projectRoot, 'desktop/src/shared/theme-registry-data.json'),
      JSON.stringify(merged, null, 2) + '\n',
      'utf-8'
    );
  },

  // Locales
  'desktop/src/locales/en.json': (file) => resolveLocaleFile(file),
  'desktop/src/locales/zh-TW.json': (file) => resolveLocaleFile(file),
  'desktop/src/locales/zh.json': (file) => resolveLocaleFile(file),

  // package.json
  'package.json': () => {
    console.log('Resolving package.json...');
    const localContent = JSON.parse(runCmd('git show HEAD:package.json'));
    const upstreamContent = JSON.parse(runCmd('git show MERGE_HEAD:package.json'));
    
    const merged = JSON.parse(JSON.stringify(upstreamContent));
    merged.description = localContent.description;
    merged.build = JSON.parse(rebrandText(JSON.stringify(localContent.build)));
    
    if (localContent.scripts) {
      merged.scripts = Object.assign({}, merged.scripts, localContent.scripts);
    }
    for (const type of ['dependencies', 'devDependencies']) {
      if (localContent[type]) {
        merged[type] = Object.assign({}, merged[type] || {}, localContent[type]);
      }
    }
    
    fs.writeFileSync(
      path.join(projectRoot, 'package.json'),
      JSON.stringify(merged, null, 2) + '\n',
      'utf-8'
    );
  },

  // MessageActions.tsx simply accepts upstream design as branch buttons are now in footers
  'desktop/src/react/components/chat/MessageActions.tsx': () => {
    console.log('Resolving MessageActions.tsx...');
    const filePath = path.join(projectRoot, 'desktop/src/react/components/chat/MessageActions.tsx');
    const upstreamContent = runCmd('git show MERGE_HEAD:desktop/src/react/components/chat/MessageActions.tsx');
    fs.writeFileSync(filePath, upstreamContent, 'utf-8');
  },

  // Core code files use line-by-line block parser
  'core/agent.ts': (file) => resolveCodeConflicts(file),
  'desktop/src/react/settings/tabs/InterfaceTab.tsx': (file) => resolveCodeConflicts(file),
  'tests/theme-registry.test.ts': (file) => resolveCodeConflicts(file),
  'desktop/src/react/components/chat/UserMessage.tsx': (file) => resolveCodeConflicts(file),
  'desktop/src/react/components/chat/AssistantMessage.tsx': (file) => resolveCodeConflicts(file),
};

function resolveCodeConflicts(file) {
  console.log(`Resolving code conflicts for ${file}...`);
  const filePath = path.join(projectRoot, file);
  const conflictedContent = fs.readFileSync(filePath, 'utf-8');
  let resolvedContent = resolveConflictBlocks(file, conflictedContent);
  
  // Post-resolution syntax cleanup for brackets outside conflict markers
  if (file.endsWith('InterfaceTab.tsx')) {
    resolvedContent = resolvedContent.replace(/\}\r?\n\}\r?\n\nexport function InterfaceTab/g, '}\n\nexport function InterfaceTab');
  } else if (file.endsWith('AssistantMessage.tsx')) {
    resolvedContent = resolvedContent.replace(/\)\}\r?\n\s+\)\}\r?\n\s+<\/div>/g, ')}\n    </div>');
  } else if (file.endsWith('theme-registry.test.ts')) {
    resolvedContent = resolvedContent.replace(/\}\);\r?\n\s+\}\);\r?\n\s+it\.each/g, '});\n\n    it.each');
  }
  
  fs.writeFileSync(filePath, resolvedContent, 'utf-8');
}

function resolveLocaleFile(file) {
  console.log(`Resolving locale file ${file}...`);
  const localContent = JSON.parse(runCmd(`git show HEAD:${file}`));
  const upstreamContent = JSON.parse(runCmd(`git show MERGE_HEAD:${file}`));
  
  const rebrandedUpstream = rebrandValue(upstreamContent);
  const merged = deepMerge(rebrandedUpstream, localContent);
  fs.writeFileSync(
    path.join(projectRoot, file),
    JSON.stringify(merged, null, 2) + '\n',
    'utf-8'
  );
}

// Scan and Rebrand all newly added or modified files in diff
function performPostMergeRebrand() {
  console.log('Scanning merged/modified files for branding updates...');
  const diffFiles = runCmd('git diff --name-only HEAD')
    .split('\n')
    .map(f => f.trim())
    .filter(f => f && fs.existsSync(path.join(projectRoot, f)));

  for (const file of diffFiles) {
    if (file.includes('node_modules') || file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.ico') || file.endsWith('.woff2')) {
      continue;
    }
    if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.cjs') || file.endsWith('.mjs')) {
      continue;
    }
    
    const filePath = path.join(projectRoot, file);
    const original = fs.readFileSync(filePath, 'utf-8');
    const rebranded = rebrandText(original);
    
    if (original !== rebranded) {
      fs.writeFileSync(filePath, rebranded, 'utf-8');
      console.log(`Auto-rebranded: ${file}`);
    }
  }
}

// MAIN AUTOMATION FLOW
function main() {
  console.log('=== Svananda Upstream Merge & Rebrand Automation ===');
  
  let hasStash = false;
  const status = runCmd('git status --porcelain').trim();
  if (status) {
    console.log('Stashing local uncommitted changes...');
    runCmd('git stash save "automated-upstream-merge-stash"');
    hasStash = true;
  }

  try {
    console.log('Fetching upstream...');
    runCmd('git fetch upstream');
    
    console.log('Attempting git merge upstream/main...');
    try {
      runCmd('git merge upstream/main --no-commit --no-ff');
      console.log('Merge completed with no conflicts!');
    } catch (mergeErr) {
      console.log('Merge encountered conflicts. Starting smart resolution...');
      
      const conflicts = runCmd('git diff --name-only --diff-filter=U')
        .split('\n')
        .map(f => f.trim())
        .filter(Boolean);

      console.log(`Conflicting files found: \n${conflicts.map(f => ` - ${f}`).join('\n')}`);
      
      for (const file of conflicts) {
        if (conflictResolvers[file]) {
          conflictResolvers[file](file);
          runCmd(`git add ${file}`);
          console.log(`Successfully resolved and staged: ${file}`);
        } else {
          console.warn(`[Warning] No auto-resolver for: ${file}. Please resolve manually.`);
        }
      }
    }

    performPostMergeRebrand();
    
    console.log('\nAuto-merge and rebranding completed successfully!');
    console.log('Please verify the changes with:');
    console.log('  npm run typecheck');
    console.log('Once verified, run "git commit" to finalize the merge.');

  } catch (err) {
    console.error('Automation failed:', err.message);
  } finally {
    if (hasStash) {
      console.log('Restoring stashed local changes...');
      try {
        runCmd('git stash pop');
      } catch (stashErr) {
        console.warn('[Warning] Stash pop had conflicts. Please resolve manually.');
      }
    }
  }
}

main();
