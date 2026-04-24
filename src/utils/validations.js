import { VALID_ROLES } from './constants.js';
import { badRequest } from './errors.js';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function requireFields(payload, fields) {
  for (const field of fields) {
    if (!isNonEmptyString(payload[field])) {
      throw badRequest(`Campo obrigatorio: ${field}`);
    }
  }
}

export function normalizeEmail(email) {
  if (!isNonEmptyString(email)) {
    throw badRequest('Email obrigatorio');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(normalizedEmail)) {
    throw badRequest('Email invalido');
  }

  return normalizedEmail;
}

export function normalizeString(
  value,
  fieldName,
  { minLength = 1, maxLength = 255, required = true } = {}
) {
  if (value == null || value === '') {
    if (!required) return null;
    throw badRequest(`Campo obrigatorio: ${fieldName}`);
  }

  if (typeof value !== 'string') {
    throw badRequest(`Campo invalido: ${fieldName}`);
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length < minLength || normalizedValue.length > maxLength) {
    throw badRequest(`Campo invalido: ${fieldName}`);
  }

  return normalizedValue;
}

export function normalizePassword(password) {
  if (!isNonEmptyString(password) || password.trim().length < 6) {
    throw badRequest('Senha deve ter pelo menos 6 caracteres');
  }

  return password.trim();
}

export function normalizeRole(role) {
  if (!isNonEmptyString(role)) {
    throw badRequest('Role obrigatorio');
  }

  const normalizedRole = role.trim().toUpperCase();

  if (!VALID_ROLES.includes(normalizedRole)) {
    throw badRequest('Role invalido');
  }

  return normalizedRole;
}

export function normalizeOptionalText(value, fieldName, maxLength = 500) {
  if (value == null || value === '') return null;

  return normalizeString(value, fieldName, {
    minLength: 1,
    maxLength,
    required: false
  });
}

export function normalizePositiveInt(
  value,
  fieldName,
  { min = 1, max = Number.MAX_SAFE_INTEGER } = {}
) {
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < min || parsedValue > max) {
    throw badRequest(`Campo invalido: ${fieldName}`);
  }

  return parsedValue;
}

export function normalizeExercises(exercises) {
  if (exercises == null) return [];

  if (!Array.isArray(exercises)) {
    throw badRequest('Campo invalido: exercises');
  }

  const usedOrders = new Set();

  return exercises.map((exercise, index) => {
    if (!exercise || typeof exercise !== 'object' || Array.isArray(exercise)) {
      throw badRequest(`Exercicio invalido na posicao ${index + 1}`);
    }

    const order = exercise.order == null
      ? index + 1
      : normalizePositiveInt(exercise.order, `exercises[${index}].order`, { max: 1000 });

    if (usedOrders.has(order)) {
      throw badRequest('Ordem dos exercicios duplicada');
    }

    usedOrders.add(order);

    return {
      name: normalizeString(exercise.name, `exercises[${index}].name`, {
        maxLength: 120
      }),
      sets: normalizePositiveInt(exercise.sets, `exercises[${index}].sets`, {
        max: 100
      }),
      reps: normalizePositiveInt(exercise.reps, `exercises[${index}].reps`, {
        max: 1000
      }),
      rest: normalizeString(exercise.rest, `exercises[${index}].rest`, {
        maxLength: 50
      }),
      description: normalizeOptionalText(exercise.description, `exercises[${index}].description`, 500),
      videoUrl: normalizeOptionalText(exercise.videoUrl, `exercises[${index}].videoUrl`, 500),
      order
    };
  });
}
