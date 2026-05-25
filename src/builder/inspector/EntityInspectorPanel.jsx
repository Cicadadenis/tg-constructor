import React from 'react';
import { getBlockDef } from '../../constructor/block_catalog.js';
import { describeAllowedConnections } from '../../constructor/graph_document/operation_registry.js';
import { getNodeCardContent } from '../nodeCard/nodeCardContent.js';
import { categoryDisplayLabel, resolveProductCategory } from '../nodeCard/nodeCardTheme.js';
import { getBlockDefinition } from '../../../core/blockRegistry.js';
import { BuilderUiContext } from '../../builderContext.js';
import { PropsPanel } from '../BuilderComponents.jsx';
import InspectorSection from './InspectorSection.jsx';
import { useInspectorDraft } from './useInspectorDraft.js';
import { fieldSectionFor, fieldsForSection } from './inspectorFieldSections.js';
import './entity-inspector.css';

function PortGroup({ title, ports }) {
  if (!ports?.length) {
    return (
      <div>
        <div className="entity-inspector__port-group-title">{title}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>—</div>
      </div>
    );
  }
  return (
    <div>
      <div className="entity-inspector__port-group-title">{title}</div>
      <div className="entity-inspector__port-pills">
        {ports.map((port) => (
          <span key={port.id} className="entity-inspector__port-pill" title={port.kind}>
            {port.label || port.id}
          </span>
        ))}
      </div>
    </div>
  );
}

function SchemaFields({ fields, draft, updateField, persistField, validation }) {
  if (!fields.length) {
    return (
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>
        Нет полей в этой секции.
      </p>
    );
  }
  return fields.map((field) => {
    const invalid = Boolean(validation);
    return (
      <label key={field.key} className="ds-field entity-inspector__field">
        <span className="ds-field__label entity-inspector__field-label">{field.label}</span>
        {field.tag === 'textarea' ? (
          <textarea
            className={`entity-inspector__textarea ds-field__control${invalid ? ' ds-field__control--invalid' : ''}`}
            rows={field.rows || 3}
            value={draft[field.key] ?? ''}
            onChange={(e) => updateField(field.key, e.target.value)}
            onBlur={(e) => persistField(field.key, e.target.value)}
            aria-invalid={invalid}
          />
        ) : (
          <input
            className={`entity-inspector__input ds-field__control${invalid ? ' ds-field__control--invalid' : ''}`}
            type={field.secret ? 'password' : 'text'}
            value={draft[field.key] ?? ''}
            onChange={(e) => updateField(field.key, e.target.value)}
            onBlur={(e) => persistField(field.key, e.target.value)}
            aria-invalid={invalid}
          />
        )}
        {invalid && (
          <p className="ds-field__error" role="alert">{validation}</p>
        )}
      </label>
    );
  });
}

const SECTION_LABELS = {
  ru: {
    basic: 'Основные',
    io: 'Входы и выходы',
    execution: 'Выполнение',
    ui: 'Интерфейс',
    advanced: 'Дополнительно',
  },
  en: {
    basic: 'Basic settings',
    io: 'Inputs / outputs',
    execution: 'Execution',
    ui: 'UI settings',
    advanced: 'Advanced',
  },
};

/**
 * Persistent right-side entity inspector — sole editing surface for canvas nodes.
 */
export default function EntityInspectorPanel({
  graph,
  nodeId,
  block,
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
  graphRevision,
  lang: langProp,
}) {
  const ctx = React.useContext(BuilderUiContext);
  const lang = langProp || ctx?.lang || 'ru';
  const labels = SECTION_LABELS[lang === 'en' ? 'en' : 'ru'];
  const blockTypes = ctx?.blockTypes;

  const nodeType = block?.type || null;
  const {
    contract,
    draft,
    validation,
    dirty,
    updateField,
    persistField,
  } = useInspectorDraft({
    graph,
    nodeId,
    nodeType,
    onValidationToast,
    graphRevision,
  });

  const allowed = nodeType ? describeAllowedConnections(nodeType) : null;
  const def = nodeType ? getBlockDef(nodeType, blockTypes) : null;
  const registryDef = nodeType ? getBlockDefinition(nodeType) : null;

  const schemaFields = contract?.inspectorSchema || [];
  const schemaKeys = React.useMemo(
    () => new Set(schemaFields.map((f) => f.key)),
    [schemaFields],
  );

  const cardPreview = React.useMemo(() => {
    if (!block || !nodeType) return null;
    return getNodeCardContent(nodeType, block.props, block.meta, {
      label: def?.label,
      description: registryDef?.description,
      category: registryDef?.category,
      lang,
    });
  }, [block, nodeType, def, registryDef, lang]);

  const onFieldChange = React.useCallback((key, val) => {
    if (schemaKeys.has(key)) {
      updateField(key, val);
    } else {
      onChange?.(key, val);
    }
  }, [schemaKeys, updateField, onChange]);

  if (!block || !nodeType || !def) {
    return null;
  }

  const productCategory = resolveProductCategory(nodeType, registryDef?.category);

  return (
    <div className="entity-inspector">
      <header className="entity-inspector__header">
        <div className="entity-inspector__header-row">
          <div className="entity-inspector__icon" aria-hidden>{def.icon}</div>
          <div className="entity-inspector__head-text">
            <div className="entity-inspector__title">{def.label}</div>
            <div className="entity-inspector__meta">
              {categoryDisplayLabel(productCategory, lang)}
              {' · '}
              <span style={{ fontFamily: 'var(--font-mono, monospace)' }}>{nodeType}</span>
            </div>
            {dirty && (
              <span className="entity-inspector__badge entity-inspector__badge--dirty">
                {lang === 'en' ? 'Unsaved draft' : 'Черновик'}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="entity-inspector__scroll">
        <InspectorSection title={labels.basic} defaultOpen>
          {contract?.description && (
            <p className="entity-inspector__description">{contract.description}</p>
          )}
          <SchemaFields
            fields={fieldsForSection(schemaFields, 'basic', nodeType)}
            draft={draft}
            updateField={updateField}
            persistField={persistField}
            validation={validation}
          />
          <div className="entity-inspector__props-embed">
            <PropsPanel
              block={block}
              onChange={onFieldChange}
              section="basic"
              excludeKeys={schemaKeys}
              embedded
            />
          </div>
        </InspectorSection>

        <InspectorSection title={labels.io} defaultOpen>
          <div className="entity-inspector__ports">
            <PortGroup title={lang === 'en' ? 'Inputs' : 'Входы'} ports={allowed?.inputs} />
            <PortGroup title={lang === 'en' ? 'Outputs' : 'Выходы'} ports={allowed?.outputs} />
          </div>
          {allowed?.maxOutputs != null && (
            <p className="entity-inspector__description" style={{ marginTop: 8 }}>
              {lang === 'en' ? 'Max outgoing edges: ' : 'Макс. исходящих связей: '}
              {allowed.maxOutputs}
            </p>
          )}
        </InspectorSection>

        <InspectorSection title={labels.execution} defaultOpen={false}>
          <SchemaFields
            fields={fieldsForSection(schemaFields, 'execution', nodeType)}
            draft={draft}
            updateField={updateField}
            persistField={persistField}
            validation={validation}
          />
          <div className="entity-inspector__props-embed">
            <PropsPanel
              block={block}
              onChange={onFieldChange}
              section="execution"
              excludeKeys={schemaKeys}
              embedded
            />
          </div>
        </InspectorSection>

        <InspectorSection title={labels.ui} defaultOpen>
          {cardPreview && (
            <div className="entity-inspector__field">
              <span className="entity-inspector__field-label">
                {lang === 'en' ? 'Canvas preview' : 'Превью на холсте'}
              </span>
              <div
                className="entity-inspector__textarea"
                style={{ minHeight: 48, whiteSpace: 'pre-wrap', background: 'var(--color-surface-muted)' }}
              >
                {cardPreview.previewBody}
              </div>
            </div>
          )}
          <SchemaFields
            fields={fieldsForSection(schemaFields, 'ui', nodeType)}
            draft={draft}
            updateField={updateField}
            persistField={persistField}
            validation={validation}
          />
          <div className="entity-inspector__props-embed">
            <PropsPanel
              block={block}
              onChange={onFieldChange}
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
              section="ui"
              excludeKeys={schemaKeys}
              embedded
            />
          </div>
        </InspectorSection>

        <InspectorSection title={labels.advanced} defaultOpen={false}>
          <SchemaFields
            fields={fieldsForSection(schemaFields, 'advanced', nodeType)}
            draft={draft}
            updateField={updateField}
            persistField={persistField}
            validation={validation}
          />
          <div className="entity-inspector__props-embed">
            <PropsPanel
              block={block}
              onChange={onFieldChange}
              section="advanced"
              excludeKeys={schemaKeys}
              embedded
            />
          </div>
        </InspectorSection>

        {validation && (
          <div style={{ padding: '0 12px 12px' }}>
            <div className="entity-inspector__validation">⚠ {validation}</div>
          </div>
        )}
      </div>

      {onDeleteNode && (
        <footer className="entity-inspector__footer">
          <button
            type="button"
            className="entity-inspector__delete"
            onClick={() => onDeleteNode(nodeId)}
          >
            {lang === 'en' ? 'Delete block' : 'Удалить блок'}
          </button>
        </footer>
      )}
    </div>
  );
}
