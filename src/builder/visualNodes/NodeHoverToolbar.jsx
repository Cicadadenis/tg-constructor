import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { nodeToolbarVariants } from '../../motion/index.js';
import { MotionPressable } from '../../motion/MotionPressable.jsx';

/**
 * Contextual floating toolbar — appears on hover / selection.
 */
export default function NodeHoverToolbar({
  visible = false,
  lang = 'ru',
  hasInlineEdit = false,
  onEdit,
  onAdd,
  onDuplicate,
  onDelete,
}) {
  const t = lang === 'en'
    ? { edit: 'Edit', add: 'Add next', dup: 'Duplicate', del: 'Delete' }
    : lang === 'uk'
      ? { edit: 'Редагувати', add: 'Далі', dup: 'Копія', del: 'Видалити' }
      : { edit: 'Править', add: 'Далее', dup: 'Копия', del: 'Удалить' };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="vn-toolbar"
          variants={nodeToolbarVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {hasInlineEdit && onEdit && (
            <MotionPressable className="vn-toolbar__btn" title={t.edit} onClick={onEdit}>
              <span className="vn-toolbar__icon">✎</span>
              <span className="vn-toolbar__label">{t.edit}</span>
            </MotionPressable>
          )}
          {onAdd && (
            <MotionPressable className="vn-toolbar__btn vn-toolbar__btn--primary" title={t.add} onClick={onAdd}>
              <span className="vn-toolbar__icon">+</span>
              <span className="vn-toolbar__label">{t.add}</span>
            </MotionPressable>
          )}
          {onDuplicate && (
            <MotionPressable className="vn-toolbar__btn" title={t.dup} onClick={onDuplicate}>
              <span className="vn-toolbar__icon">⎘</span>
            </MotionPressable>
          )}
          {onDelete && (
            <MotionPressable className="vn-toolbar__btn vn-toolbar__btn--danger" title={t.del} onClick={onDelete}>
              <span className="vn-toolbar__icon">✕</span>
            </MotionPressable>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
