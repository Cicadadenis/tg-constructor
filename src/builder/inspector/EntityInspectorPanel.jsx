import React from 'react';
import { getBlockDef } from '../../constructor/block_catalog.js';
import { describeAllowedConnections } from '../../constructor/graph_document/operation_registry.js';
import { getBlockDefinition } from '../../../core/blockRegistry.js';
import { BuilderUiContext } from '../../builderContext.js';
import { PropsPanel } from '../BuilderComponents.jsx';
import FlowInspectorSection from '../../flow-editor/inspector/FlowInspectorSection.jsx';
import {
  FlowInspectorAudiencePanel,
  FlowInspectorAnalyticsPanel,
} from '../../flow-editor/inspector/FlowInspectorContextPanels.jsx';
import { normalizeInspectorTab } from '../../flow-editor/inspector/inspectorTabs.js';
import { useInspectorDraft } from './useInspectorDraft.js';
import { fieldsForSection } from './inspectorFieldSections.js';
import './entity-inspector.css';

function FriendlyConnections({ allowed, lang }) {
  const inLabel = lang === 'en' ? 'Comes from' : 'Приходит из';
  const outLabel = lang === 'en' ? 'Goes to' : 'Ведёт к';
  const emptyIn = lang === 'en' ? 'Flow start or any step' : 'Старт или любой шаг';
  const emptyOut = lang === 'en' ? 'Next step or end' : 'Следующий шаг или конец';

  const inputs = allowed?.inputs || [];
  const outputs = allowed?.outputs || [];

  return (
    <div className="fi-connections">
      <div className="fi-connections__row">
        <div className="fi-connections__label">{inLabel}</div>
        <div className="fi-connections__chips">
          {inputs.length ? inputs.map((p) => (
            <span key={p.id} className="fi-connections__chip">{p.label || p.id}</span>
          )) : (
            <span className="fi-connections__empty">{emptyIn}</span>
          )}
        </div>
      </div>
      <div className="fi-connections__row">
        <div className="fi-connections__label">{outLabel}</div>
        <div className="fi-connections__chips">
          {outputs.length ? outputs.map((p) => (
            <span key={p.id} className="fi-connections__chip">{p.label || p.id}</span>
          )) : (
            <span className="fi-connections__empty">{emptyOut}</span>
          )}
        </div>
      </div>
      {allowed?.maxOutputs != null && (
        <p className="fi-field__hint">
          {lang === 'en'
            ? `Up to ${allowed.maxOutputs} outgoing connection(s)`
            : `До ${allowed.maxOutputs} исходящих связей`}
        </p>
      )}
    </div>
  );
}

function SchemaFields({ fields, draft, updateField, persistField, validation, lang, emptyHint }) {
  if (!fields.length) {
    return emptyHint ? <p className="fi-field__hint">{emptyHint}</p> : null;
  }
  return fields.map((field) => {
    const invalid = Boolean(validation);
    const fieldValidation = invalid ? validation : null;
    return (
      <label
        key={field.key}
        className={`fi-field entity-inspector__field${invalid ? ' fi-field--invalid' : ''}`}
      >
        <span className="fi-field__label entity-inspector__field-label">{field.label}</span>
        {field.tag === 'textarea' ? (
          <textarea
            className={`fi-field__textarea entity-inspector__textarea${invalid ? ' fi-field__input--invalid' : ''}`}
            rows={field.rows || 3}
            value={draft[field.key] ?? ''}
            onChange={(e) => updateField(field.key, e.target.value)}
            onBlur={(e) => persistField(field.key, e.target.value)}
            aria-invalid={invalid}
            placeholder={field.placeholder}
          />
        ) : (
          <input
            className={`fi-field__input entity-inspector__input${invalid ? ' fi-field__input--invalid' : ''}`}
            type={field.secret ? 'password' : 'text'}
            value={draft[field.key] ?? ''}
            onChange={(e) => updateField(field.key, e.target.value)}
            onBlur={(e) => persistField(field.key, e.target.value)}
            aria-invalid={invalid}
            placeholder={field.placeholder}
          />
        )}
        {fieldValidation && (
          <p className="fi-field__error" role="alert">{fieldValidation}</p>
        )}
      </label>
    );
  });
}

const TAB_SECTION_LABELS = {
  ru: {
    message: 'Сообщение',
    behavior: 'Поведение',
    connections: 'Связи',
    timing: 'Тайминги и режим',
    advanced: 'Дополнительно',
    developer: 'Разработчик',
  },
  en: {
    message: 'Message',
    behavior: 'Behavior',
    connections: 'Connections',
    timing: 'Timing & mode',
    advanced: 'Advanced',
    developer: 'Developer',
  },
};

/**
 * Tab-scoped entity fields — rendered inside FlowInspector shell.
 */
export default function EntityInspectorPanel({
  activeTab: activeTabProp = 'content',
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
  flowName,
  nodeCount = 0,
  aiCopyVariants = null,
  onApplyAiVariant,
}) {
  const ctx = React.useContext(BuilderUiContext);
  const lang = langProp || ctx?.lang || 'ru';
  const sl = TAB_SECTION_LABELS[lang === 'en' ? 'en' : 'ru'];
  const blockTypes = ctx?.blockTypes;
  const activeTab = normalizeInspectorTab(activeTabProp);

  const nodeType = block?.type || null;
  const {
    contract,
    draft,
    validation,
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

  const emptySection = lang === 'en'
    ? 'No fields here — check other tabs.'
    : 'Здесь нет полей — смотрите другие вкладки.';

  if (activeTab === 'audience') {
    return (
      <div className="fi-entity entity-inspector">
        <FlowInspectorAudiencePanel lang={lang} blockType={nodeType} />
      </div>
    );
  }

  if (activeTab === 'analytics') {
    return (
      <div className="fi-entity entity-inspector">
        <FlowInspectorAnalyticsPanel
          lang={lang}
          blockType={nodeType}
          flowName={flowName}
          nodeCount={nodeCount}
        />
      </div>
    );
  }

  if (activeTab === 'content') {
    return (
      <div className="fi-entity entity-inspector">
        <div className="entity-inspector__scroll">
          {contract?.description && (
            <p className="fi-description" style={{ padding: '12px 0 0' }}>{contract.description}</p>
          )}
          <FlowInspectorSection title={sl.message} defaultOpen sticky>
            <SchemaFields
              fields={[
                ...fieldsForSection(schemaFields, 'basic', nodeType),
                ...fieldsForSection(schemaFields, 'ui', nodeType),
              ]}
              draft={draft}
              updateField={updateField}
              persistField={persistField}
              validation={validation}
              lang={lang}
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
            <div className="entity-inspector__props-embed">
              <PropsPanel
                block={block}
                onChange={onFieldChange}
                section="basic"
                excludeKeys={schemaKeys}
                embedded
              />
            </div>
          </FlowInspectorSection>

          {aiCopyVariants?.length > 0 && (
            <div className="fi-ai-strip" style={{ margin: '0 14px 14px' }}>
              <strong style={{ fontSize: 12 }}>✨ AI</strong>
              <div className="fi-ai-strip__variants">
                {aiCopyVariants.map((v, i) => (
                  <button
                    key={i}
                    type="button"
                    className="fi-ai-strip__variant"
                    onClick={() => onApplyAiVariant?.(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activeTab === 'logic') {
    return (
      <div className="fi-entity entity-inspector">
        <div className="entity-inspector__scroll">
          <FlowInspectorSection title={sl.connections} defaultOpen>
            <FriendlyConnections allowed={allowed} lang={lang} />
          </FlowInspectorSection>
          <FlowInspectorSection title={sl.timing} defaultOpen>
            <SchemaFields
              fields={fieldsForSection(schemaFields, 'execution', nodeType)}
              draft={draft}
              updateField={updateField}
              persistField={persistField}
              validation={validation}
              lang={lang}
              emptyHint={emptySection}
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
          </FlowInspectorSection>
          <FlowInspectorSection title={sl.behavior} defaultOpen={false}>
            <SchemaFields
              fields={fieldsForSection(schemaFields, 'io', nodeType)}
              draft={draft}
              updateField={updateField}
              persistField={persistField}
              validation={validation}
              lang={lang}
              emptyHint={emptySection}
            />
          </FlowInspectorSection>
        </div>
      </div>
    );
  }

  if (activeTab === 'settings') {
    return (
      <div className="fi-entity entity-inspector">
        <div className="entity-inspector__scroll">
          <FlowInspectorSection title={sl.advanced} defaultOpen>
            <SchemaFields
              fields={fieldsForSection(schemaFields, 'advanced', nodeType)}
              draft={draft}
              updateField={updateField}
              persistField={persistField}
              validation={validation}
              lang={lang}
              emptyHint={emptySection}
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
          </FlowInspectorSection>
          <FlowInspectorSection title={sl.developer} defaultOpen={false}>
            <div className="fi-dev">
              <p className="fi-field__hint" style={{ marginBottom: 8 }}>
                {lang === 'en' ? 'Internal block type' : 'Системный тип блока'}
              </p>
              <code className="fi-dev__type">{nodeType}</code>
            </div>
          </FlowInspectorSection>
        </div>
        {onDeleteNode && (
          <footer className="fi-footer">
            <button
              type="button"
              className="fi-footer__delete"
              onClick={() => onDeleteNode(nodeId)}
            >
              {lang === 'en' ? 'Remove this step' : 'Удалить этот шаг'}
            </button>
          </footer>
        )}
      </div>
    );
  }

  return null;
}
