import { useCallback, useState } from 'react';
import { validateForm } from './formValidation.js';

/**
 * Controlled field with inline validation.
 * @param {object} options
 * @param {Record<string, unknown>} options.initialValues
 * @param {Record<string, Array<(v: unknown, all: Record<string, unknown>) => string | null>>} options.rules
 */
export function useFormField(options) {
  const { initialValues = {}, rules = {} } = options;
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const setValue = useCallback((key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const touch = useCallback((key) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
  }, []);

  const validate = useCallback(() => {
    const result = validateForm(values, rules);
    setErrors(result.errors);
    return result.ok;
  }, [values, rules]);

  const getFieldProps = useCallback((key) => ({
    value: values[key] ?? '',
    onChange: (e) => setValue(key, e.target?.value ?? e),
    onBlur: () => {
      touch(key);
      const result = validateForm(values, { [key]: rules[key] || [] });
      if (result.errors[key]) {
        setErrors((prev) => ({ ...prev, [key]: result.errors[key] }));
      }
    },
    'aria-invalid': Boolean(touched[key] && errors[key]),
  }), [values, rules, errors, touched, setValue, touch]);

  return {
    values,
    errors,
    touched,
    setValue,
    touch,
    validate,
    getFieldProps,
    setValues,
    setErrors,
  };
}
