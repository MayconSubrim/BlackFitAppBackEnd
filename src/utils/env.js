export function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Configuracao obrigatoria ausente: ${name}`);
  }

  return value;
}
