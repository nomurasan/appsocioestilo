/**
 * Validador de Variáveis de Ambiente Públicas - Potenciar Socioestilo
 * Protege a inicialização contra falhas silenciosas de build no Easypanel
 */

export interface EnvValidationResult {
  isValid: boolean;
  missingVariables: string[];
}

export function validateFrontendEnv(): EnvValidationResult {
  const env = (import.meta as any).env || {};

  const requiredKeys = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID'
  ];

  const missingVariables = requiredKeys.filter(
    (key) => !env[key] || env[key].trim() === '' || env[key].startsWith('SUA_')
  );

  const isValid = missingVariables.length === 0;

  if (!isValid) {
    console.warn(
      `\n=================================================================\n` +
      `🛡️ [AVISO DE CONFIGURAÇÃO] Variáveis de ambiente ausentes no frontend:\n` +
      missingVariables.map(v => `   - ${v}`).join('\n') +
      `\n\nIsso pode limitar as conexões com o Supabase e Firebase na VPS.\n` +
      `Cadastre-as adequadamente no menu de variáveis do Easypanel do seu build Vite.\n` +
      `=================================================================\n`
    );
  } else {
    console.log('🛡️ [SECURITY] Todas as variáveis corporativas públicas do Frontend foram validadas com sucesso!');
  }

  return {
    isValid,
    missingVariables
  };
}
