import React, { useState } from 'react';
import { AlertCircle, Shield, Mail, Lock, UserPlus, LogIn, Chrome } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { auth as fbAuth, googleProvider, signInWithPopup } from '../lib/firebase';
import Logo from './Logo';

interface AuthScreenProps {
  onSuccess: (uid: string, email: string) => void;
}

export default function AuthScreen({ onSuccess }: AuthScreenProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isUnauthorizedDomain, setIsUnauthorizedDomain] = useState(false);
  
  // Tab control: 'google' | 'password'
  const [authMethod, setAuthMethod] = useState<'google' | 'password'>('google');
  
  // Password flow states
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    setIsUnauthorizedDomain(false);

    console.log('[DEBUG AUTH] Solicitando login via Google usando Firebase Auth...');

    try {
      const result = await signInWithPopup(fbAuth, googleProvider);
      console.log('[DEBUG AUTH] Sucesso no login via Google Firebase:', result.user.email);
      onSuccess(result.user.uid, result.user.email || '');
    } catch (err: any) {
      console.error('Erro de autenticação com Google via Firebase Auth:', err);
      const isAuthDomainErr = err.code === 'auth/unauthorized-domain' || (err.message && err.message.includes('auth/unauthorized-domain'));
      if (isAuthDomainErr) {
        setIsUnauthorizedDomain(true);
        setError('Este domínio não está autorizado para autenticação no Console do Firebase.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('O login via Google foi cancelado ou o pop-up foi fechado pelo usuário.');
      } else {
        setError(err.message || 'Ocorreu um erro ao conectar com o Google usando Firebase.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError('Por favor, preencha o e-mail e a senha.');
      setLoading(false);
      return;
    }

    try {
      if (isSignUp) {
        // Sign-up flow
        const { data, error: supaErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: {
              full_name: nome.trim() || undefined
            }
          }
        });
        if (supaErr) throw supaErr;
        
        if (data.user && data.session) {
          onSuccess(data.user.id, data.user.email || '');
        } else {
          setError('Cadastro realizado! Por favor, verifique seu e-mail para confirmação ou tente fazer login.');
        }
      } else {
        // Sign-in flow
        const { data, error: supaErr } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword
        });
        if (supaErr) throw supaErr;
        
        if (data.user) {
          onSuccess(data.user.id, data.user.email || '');
        }
      }
    } catch (err: any) {
      console.error('Password Auth Error:', err);
      setError(err.message || 'Credenciais inválidas ou erro ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 max-w-md w-full mx-auto animate-fade-in" id="auth-container">
      {/* Brand logo at core center */}
      <Logo size="md" className="mb-6 justify-center w-full" />
      
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 w-full relative overflow-hidden" id="auth-card">
        {/* Sleek crimson highlight strip */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#D80E2A]" />

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-[#112363]" id="auth-title">
            Portal de Avaliação
          </h2>
          <p className="text-gray-500 text-xs mt-1.5" id="auth-subtitle">
            Faça login para iniciar sua avaliação de Socioestilo.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-gray-100 mb-6 font-semibold text-xxs tracking-wider uppercase">
          <button
            onClick={() => { setAuthMethod('google'); setError(null); }}
            className={`flex-1 py-2.5 text-center transition-all border-b-2 cursor-pointer ${
              authMethod === 'google' 
                ? 'border-[#112363] text-[#112363]' 
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            Acesso Rápido Google
          </button>
          <button
            onClick={() => { setAuthMethod('password'); setError(null); }}
            className={`flex-1 py-2.5 text-center transition-all border-b-2 cursor-pointer ${
              authMethod === 'password' 
                ? 'border-[#112363] text-[#112363]' 
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            E-mail corporativo
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 flex items-start space-x-3 text-red-800 animate-slide-up" id="auth-error-block">
            <AlertCircle className="w-5 h-5 text-[#D80E2A] shrink-0 mt-0.5" />
            <div className="text-xs font-semibold leading-relaxed flex-1">
              <span>{error}</span>
              {isUnauthorizedDomain && (
                <div className="mt-3 p-3 bg-white border border-red-100 rounded-lg text-gray-700 space-y-3 font-normal" id="unauthorized-domain-instructions">
                  <p className="text-[11px] text-gray-600">
                    Como o portal está rodando no ambiente seguro de desenvolvimento do AI Studio, você precisa autorizar os domínios de pré-visualização no console do seu Firebase:
                  </p>
                  
                  <div className="space-y-1">
                    <p className="font-bold text-[10px] text-gray-500 uppercase tracking-wider">Domínios a serem adicionados:</p>
                    <div className="bg-gray-50 p-2.5 rounded border border-gray-100 font-mono text-[10px] space-y-1 text-gray-800 select-all">
                      <div>{window.location.hostname}</div>
                      <div>{window.location.hostname.replace('-dev-', '-pre-')}</div>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <p className="font-bold text-[10px] text-[#112363] uppercase tracking-wider">Siga os passos rápidos:</p>
                    <ol className="list-decimal list-inside text-xs text-gray-600 space-y-1">
                      <li>Acesse o <a href="https://console.firebase.google.com/project/gen-lang-client-0279925838/authentication/settings" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-semibold inline-flex items-center">Console Firebase Auth ↗</a>.</li>
                      <li>Clique na aba <b>Authorized domains</b> (Domínios autorizados).</li>
                      <li>Clique em <b>Add domain</b> (Adicionar domínio) e insira os dois domínios acima.</li>
                      <li>Atualize a página e tente o login do Google novamente!</li>
                    </ol>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {authMethod === 'google' ? (
          <div className="space-y-4" id="auth-actions-google">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center space-x-3 bg-white border border-gray-200 text-gray-700 py-3.5 px-4 rounded-xl text-sm font-semibold hover:bg-gray-50 hover:border-gray-300 active:scale-[0.99] transition-all shadow-xs cursor-pointer disabled:opacity-50"
              id="btn-google-login"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : (
                <>
                  <Chrome className="w-5 h-5 text-red-500" />
                  <span>Entrar com a Conta do Google</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-gray-400 text-center leading-relaxed mt-2">
              Utilize esta opção para login corporativo rápido e seguro via Google Workspace ou Gmail corporativo.
            </p>
            
            <div className="mt-4 p-4 rounded-xl bg-emerald-50/80 border border-emerald-100 text-[#065f46] text-[11px] leading-relaxed space-y-2">
              <div className="flex items-center space-x-2 font-bold text-[#047857]">
                <Shield className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>💡 Acesso Altamente Seguro</span>
              </div>
              <p>
                O sistema utiliza a autenticação oficial do Google Cloud. Suas credenciais são gerenciadas diretamente por servidores do Google com criptografia de ponta.
              </p>
              <div className="pt-1 text-emerald-700/80 text-[10px]">
                Após o login do Google, seu perfil e dados de diagnóstico continuarão sendo salvos de forma independente via Supabase RPC.
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handlePasswordAuth} className="space-y-4" id="auth-form-password">
            {isSignUp && (
              <div>
                <label className="block text-xxs font-bold text-[#112363] uppercase tracking-wider mb-1.5">
                  Nome Completo
                </label>
                <input
                  type="text"
                  placeholder="Seu nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-4 py-3 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#112363]/10 focus:border-[#112363] transition-all outline-none"
                  required={isSignUp}
                />
              </div>
            )}

            <div>
              <label className="block text-xxs font-bold text-[#112363] uppercase tracking-wider mb-1.5">
                E-mail Corporativo
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  placeholder="nome@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#112363]/10 focus:border-[#112363] transition-all outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xxs font-bold text-[#112363] uppercase tracking-wider mb-1.5">
                Senha
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-[#112363]/10 focus:border-[#112363] transition-all outline-none"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 bg-[#112363] text-white py-3.5 px-4 rounded-xl text-xs font-bold hover:bg-[#112363]/90 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              ) : isSignUp ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Registrar e Começar</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Entrar com E-mail</span>
                </>
              )}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
                className="text-xxs text-[#112363] font-bold hover:underline cursor-pointer"
              >
                {isSignUp ? 'Já tem uma conta? Conectar' : 'Não tem uma conta cadastrada? Registrar-se'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Helpful safety guidelines badge */}
      <div className="mt-6 text-center">
        <p className="text-[10px] text-gray-400 flex items-center justify-center">
          Autenticação criptografada e segura via Supabase API.
        </p>
      </div>
    </div>
  );
}
