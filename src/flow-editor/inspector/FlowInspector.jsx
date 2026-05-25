import React from 'react';
import { getBlockDef } from '../../constructor/block_catalog.js';
import { getNodeCardContent } from '../../builder/nodeCard/nodeCardContent.js';
import { categoryDisplayLabel, resolveProductCategory } from '../../builder/nodeCard/nodeCardTheme.js';
import { getBlockDefinition } from '../../../core/blockRegistry.js';
import { graphCanDuplicateNodeType } from '../../app/graph/graphHelpers.js';
import { copywritingAssist } from '../../ai/aiFlowClient.js';
import AiCopilotPanel from '../../ai/AiCopilotPanel.jsx';
import '../../ai/ai-flow-studio.css';
import EntityInspectorPanel from '../../builder/inspector/EntityInspectorPanel.jsx';
import FlowInspectorShell from './FlowInspectorShell.jsx';
import FlowInspectorHeader from './FlowInspectorHeader.jsx';
import FlowInspectorPreview from './FlowInspectorPreview.jsx';
import InspectorLiveSimulator from './InspectorLiveSimulator.jsx';
import { useInspectorDraft } from '../../builder/inspector/useInspectorDraft.js';
import { normalizeInspectorTab } from './inspectorTabs.js';

/**
 * ManyChat-style right inspector — orchestrates shell, header, preview, entity tabs.
 */
export default function FlowInspector({
  tab: tabProp,
  onTabChange,
  lang = 'ru',
  canSeeCode = false,
  onLockedCodeTab,
  codePane = null,
  lockedCodePane = null,
  simulatorProps = null,
  onFocusCanvas,
  onUndockSimulator,
  /* selection */
  block = null,
  nodeId = null,
  graph = null,
  graphRevision = 0,
  flowName = '',
  nodeCount = 0,
  blockTypes,
  /* entity handlers */
  onChange,
  onKeyboardDataChange,
  onAddAttachment,
  onAttachmentChange,
  onAttachmentDelete,
  graphRefIndex,
  graphDocument,
  onJumpToNode,
  onCreateCallbackHandler,
  projectId,
  isProjectMode,
  hasActiveProSubscription,
  onDeleteNode,
  onValidationToast,
  onDuplicateNode,
  onConvertNode,
  showToast,
}) {
  const tab = normalizeInspectorTab(tabProp);
  const [previewOpen, setPreviewOpen] = React.useState(true);
  const [aiLoading, setAiLoading] = React.useState(false);
  const [aiVariants, setAiVariants] = React.useState([]);

  const nodeType = block?.type || null;
  const def = nodeType ? getBlockDef(nodeType, blockTypes) : null;
  const registryDef = nodeType ? getBlockDefinition(nodeType) : null;
  const hasSelection = Boolean(block && nodeId && def);

  const { validation } = useInspectorDraft({
    graph,
    nodeId,
    nodeType,
    onValidationToast,
    graphRevision,
  });

  const cardPreview = React.useMemo(() => {
    if (!block || !nodeType) return null;
    return getNodeCardContent(nodeType, block.props, block.meta, {
      label: def?.label,
      description: registryDef?.description,
      category: registryDef?.category,
      lang,
    });
  }, [block, nodeType, def, registryDef, lang]);

  const productCategory = nodeType
    ? resolveProductCategory(nodeType, registryDef?.category)
    : null;

  const handleAiImprove = React.useCallback(async () => {
    if (!block) return;
    const text = block.props?.text || block.props?.question || '';
    if (!String(text).trim()) {
      showToast?.(
        lang === 'en' ? 'Add text first' : 'Сначала добавьте текст',
        'info',
      );
      return;
    }
    setAiLoading(true);
    setAiVariants([]);
    try {
      const res = await copywritingAssist(text, { prompt: '' });
      setAiVariants(res.copywriting?.variants || []);
      if (!res.copywriting?.variants?.length) {
        showToast?.(lang === 'en' ? 'No suggestions' : 'Нет предложений', 'info');
      }
    } catch (e) {
      showToast?.(e.message, 'error');
    } finally {
      setAiLoading(false);
    }
  }, [block, lang, showToast]);

  React.useEffect(() => {
    setAiVariants([]);
  }, [nodeId]);

  const handleApplyVariant = React.useCallback((variant) => {
    const key = block?.props?.question != null ? 'question' : 'text';
    onChange?.(key, variant);
    setAiVariants([]);
    showToast?.(lang === 'en' ? 'Applied' : 'Применено', 'success');
  }, [block, onChange, lang, showToast]);

  const header = hasSelection ? (
    <FlowInspectorHeader
      icon={def.icon}
      title={def.label}
      categoryLabel={categoryDisplayLabel(productCategory, lang)}
      lang={lang}
      quickActions={{
        onDuplicate: onDuplicateNode ? () => onDuplicateNode(nodeId) : undefined,
        canDuplicate: graphCanDuplicateNodeType(nodeType),
        onDelete: onDeleteNode ? () => onDeleteNode(nodeId) : undefined,
        canDelete: Boolean(onDeleteNode),
        onAiImprove: handleAiImprove,
        aiLoading,
        onConvert: onConvertNode,
      }}
    />
  ) : null;

  const showStaticPreview = hasSelection && cardPreview && !simulatorProps;

  const preview = showStaticPreview ? (
    <FlowInspectorPreview
      lang={lang}
      icon={def.icon}
      title={cardPreview.previewTitle}
      body={cardPreview.previewBody}
      categoryLabel={cardPreview.categoryLabel}
      validation={validation}
      expanded={previewOpen}
      onToggle={() => setPreviewOpen((v) => !v)}
    />
  ) : null;

  const simulatorPane = simulatorProps ? (
    <InspectorLiveSimulator
      lang={lang}
      onUndock={onUndockSimulator}
      {...simulatorProps}
    />
  ) : null;

  return (
    <FlowInspectorShell
      tab={tab}
      onTabChange={onTabChange}
      lang={lang}
      hasSelection={hasSelection}
      header={header}
      preview={preview}
      canSeeCode={canSeeCode}
      onLockedCodeTab={onLockedCodeTab}
      codePane={codePane}
      lockedCodePane={lockedCodePane}
      simulatorPane={simulatorPane}
      onFocusCanvas={onFocusCanvas}
    >
      {hasSelection && graph && (
        <AiCopilotPanel
          graph={graph}
          selectedBlockId={nodeId}
          selectedBlock={block}
          onApplyText={onChange}
          onRepairHighlight={(ids) => {
            if (Array.isArray(ids)) {
              ids.forEach((id) => onJumpToNode?.(id));
            }
          }}
          lang={lang}
        />
      )}
      <EntityInspectorPanel
        activeTab={tab}
        graph={graph}
        graphRevision={graphRevision}
        nodeId={nodeId}
        block={block}
        lang={lang}
        flowName={flowName}
        nodeCount={nodeCount}
        onChange={onChange}
        onKeyboardDataChange={onKeyboardDataChange}
        onAddAttachment={onAddAttachment}
        onAttachmentChange={onAttachmentChange}
        onAttachmentDelete={onAttachmentDelete}
        graphRefIndex={graphRefIndex}
        graphDocument={graphDocument}
        onJumpToNode={onJumpToNode}
        onCreateCallbackHandler={onCreateCallbackHandler}
        projectId={projectId}
        isProjectMode={isProjectMode}
        hasActiveProSubscription={hasActiveProSubscription}
        onDeleteNode={onDeleteNode}
        onValidationToast={onValidationToast}
        aiCopyVariants={aiVariants}
        onApplyAiVariant={handleApplyVariant}
      />
    </FlowInspectorShell>
  );
}
