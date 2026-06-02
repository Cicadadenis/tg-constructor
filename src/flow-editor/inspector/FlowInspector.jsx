import React from 'react';
import { getBlockDef } from '../../constructor/block_catalog.js';
import { getNodeCardContent } from '../../builder/nodeCard/nodeCardContent.js';
import { categoryDisplayLabel, resolveProductCategory } from '../../builder/nodeCard/nodeCardTheme.js';
import { getBlockDefinition } from '../../../core/blockRegistry.js';
import { graphCanDuplicateNodeType } from '../../app/graph/graphHelpers.js';
import EntityInspectorPanel from '../../builder/inspector/EntityInspectorPanel.jsx';
import FlowInspectorShell from './FlowInspectorShell.jsx';
import FlowInspectorHeader from './FlowInspectorHeader.jsx';
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
  onFocusCanvas,
  onSaveProject,
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

  const header = hasSelection ? (
    <FlowInspectorHeader
      icon={def.icon}
      title={def.label}
      categoryLabel={categoryDisplayLabel(productCategory, lang)}
      statusBadge={(
        <span className="fi-header__type" title={nodeType}>
          {nodeType}
        </span>
      )}
      lang={lang}
      quickActions={{
        onSave: onSaveProject ? () => onSaveProject() : undefined,
        canSave: Boolean(onSaveProject),
        onDuplicate: onDuplicateNode ? () => onDuplicateNode(nodeId) : undefined,
        canDuplicate: graphCanDuplicateNodeType(nodeType),
        onDelete: onDeleteNode ? () => onDeleteNode(nodeId) : undefined,
        canDelete: Boolean(onDeleteNode),
      }}
    />
  ) : null;

  return (
    <FlowInspectorShell
      tab={tab}
      onTabChange={onTabChange}
      lang={lang}
      hasSelection={hasSelection}
      header={header}
      canSeeCode={canSeeCode}
      onLockedCodeTab={onLockedCodeTab}
      codePane={codePane}
      lockedCodePane={lockedCodePane}
      onFocusCanvas={onFocusCanvas}
    >
      <EntityInspectorPanel
        activeTab="content"
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
      />
    </FlowInspectorShell>
  );
}
