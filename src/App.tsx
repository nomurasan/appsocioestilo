import React, { useState, useEffect } from 'react';
import { supabase, buscarUsuario, buscarUsuarioPorEmail, listarResultadosUsuario, listarOrientadorRelatoriosUsuario, listarResultados, atualizarUsuario, mapFirebaseUidToUuid, syncFirebaseUserWithSupabaseAuth } from './lib/supabase';
import { auth as fbAuth, signOut as fbSignOut } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Usuario, Resultado } from './types';

// Core layout & panels
import Header from './components/Header';
import AuthScreen from './components/AuthScreen';
import OnboardingScreen from './components/OnboardingScreen';
import QuestionnaireScreen from './components/QuestionnaireScreen';
import DashboardScreen from './components/DashboardScreen';
import MenuScreen from './components/MenuScreen';
import AdminScreen from './components/AdminScreen';
import { RefreshCw, LayoutDashboard } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<{ uid: string; email: string } | null>(null);
  const [userProfile, setUserProfile] = useState<Usuario | null>(null);
  const [myResult, setMyResult] = useState<Resultado | null>(null);

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'loading' | 'auth' | 'onboarding' | 'menu' | 'questionnaire' | 'dashboard' | 'admin'>('loading');
  const [adminViewUser, setAdminViewUser] = useState<{ user: Usuario; result: Resultado } | null>(null);
  const [adminSelectedCompany, setAdminSelectedCompany] = useState<{ id: string; nome: string } | null>(null);

  const getResultTime = (result: Resultado) => {
    const rawDate = result.generated_at || result.data_conclusao || '';
    const time = rawDate ? new Date(rawDate).getTime() : 0;
    return Number.isFinite(time) ? time : 0;
  };

  const findLatestResultForUser = async (
    profile: Usuario,
    originalUid: string,
    resolvedId: string
  ): Promise<Resultado | null> => {
    const candidateIds = Array.from(new Set([
      originalUid,
      resolvedId,
      profile.uid,
      mapFirebaseUidToUuid(originalUid),
      mapFirebaseUidToUuid(resolvedId),
      mapFirebaseUidToUuid(profile.uid)
    ].filter(Boolean)));

    const foundById: Resultado[] = [];

    for (const candidateId of candidateIds) {
      try {
        const results = await listarResultadosUsuario(candidateId);
        foundById.push(...results);
      } catch (err) {
        console.warn(`[RESULTADOS] Falha ao buscar relatorios para uid candidato ${candidateId}:`, err);
      }

      try {
        const indexedReports = await listarOrientadorRelatoriosUsuario(candidateId);
        foundById.push(...indexedReports);
      } catch (err) {
        console.warn(`[ORIENTADOR] Falha ao buscar indice de relatorios para uid candidato ${candidateId}:`, err);
      }
    }

    if (foundById.length > 0) {
      const uniqueResults = Array.from(
        new Map<string, Resultado>(foundById.map(result => [result.id_resultado || result.id || `${result.id_usuario}-${result.data_conclusao}`, result])).values()
      );
      uniqueResults.sort((a, b) => getResultTime(b) - getResultTime(a));
      return uniqueResults[0];
    }

    try {
      const allResults = await listarResultados().catch(() => []);
      const normalizedProfileName = profile.nome.trim().toLowerCase();
      const allAvailableReports: Resultado[] = allResults;
      const uniqueAvailableReports = Array.from(
        new Map<string, Resultado>(allAvailableReports.map(result => [result.id_resultado || result.id || `${result.id_usuario}-${result.data_conclusao}`, result])).values()
      );
      const filtered = uniqueAvailableReports.filter(result => {
        const sameUserId = candidateIds.includes(String(result.id_usuario || ''));
        const sameName = normalizedProfileName && String(result.nome_usuario || result.user_name || '').trim().toLowerCase() === normalizedProfileName;
        const sameCompany = !profile.empresa_id || String(result.empresa_id || '') === String(profile.empresa_id);
        return sameUserId || (sameName && sameCompany);
      });

      filtered.sort((a, b) => getResultTime(b) - getResultTime(a));
      return filtered[0] || null;
    } catch (err) {
      console.warn('[RESULTADOS] Fallback geral de relatorios falhou:', err);
      return null;
    }
  };

  // Helper handling user authenticated data loading
  const handleAuthUser = async (userObj: { id: string; email: string | null; origin: string } | null) => {
    setLoading(true);
    if (!userObj) {
      setCurrentUser(null);
      setUserProfile(null);
      setMyResult(null);
      setStep('auth');
      setLoading(false);
      return;
    }

    // Keep original UID for buscar_usuario (which will map internally)
    const originalUid = userObj.id;
    let resolvedId = userObj.id;

    if (userObj.origin === 'firebase') {
      try {
        resolvedId = await syncFirebaseUserWithSupabaseAuth(userObj.id, userObj.email || '');
      } catch (err) {
        console.error("Error syncing Firebase user with Supabase Auth:", err);
      }
    }

    const mappedUser = { uid: resolvedId, email: userObj.email || '' };
    setCurrentUser(mappedUser);

    try {
      // First try to resolve the user by email, because the email is the canonical registration key in Supabase.
      let profile: Usuario | null = null;
      if (userObj.email) {
        profile = await buscarUsuarioPorEmail(userObj.email);
      }

      // If no profile is found by email, fall back to UID lookup.
      if (!profile) {
        profile = await buscarUsuario(originalUid);
      }

      // Self-healing migration for legacy users: if no profile exists for original UID but one exists under a different mapping, try additional lookups.
      if (!profile && userObj.origin === 'firebase') {
        // 1) Try the resolved Supabase auth UID, if different from the Firebase UID.
        if (resolvedId && resolvedId !== originalUid) {
          profile = await buscarUsuario(resolvedId);
        }
      }

      if (!profile) {
        const mappedUid = mapFirebaseUidToUuid(userObj.id);
        if (mappedUid && mappedUid !== originalUid && mappedUid !== resolvedId) {
          profile = await buscarUsuario(mappedUid);
        }
      }

      if (!profile && userObj.origin === 'firebase') {
        const legacyUid = mapFirebaseUidToUuid(userObj.id);
        if (legacyUid && legacyUid !== originalUid && legacyUid !== resolvedId) {
          profile = await buscarUsuario(legacyUid);
        }
      }

      if (profile) {
        setMyResult(null);
        // Auto-upgrade user profile to admin if email matches nomura.eduardo@gmail.com
        if (mappedUser.email === 'nomura.eduardo@gmail.com' && profile.role !== 'admin') {
          profile.role = 'admin';
          try {
            await atualizarUsuario(profile.uid, profile.email, profile.nome, profile.empresa_id, 'admin', profile.perfil_dominante || null);
          } catch (err) {
            console.error("Erro ao auto-promover para admin:", err);
          }
        }
        setUserProfile(profile);

        // Check if user has already taken the test previously via RPC, with a bulletproof localStorage fallback
        let latestResult: Resultado | null = null;
        try {
          latestResult = await findLatestResultForUser(profile, originalUid, resolvedId);
        } catch (dbErr) {
          console.warn("Could not load results from database, trying local cache:", dbErr);
        }

        if (!latestResult) {
          try {
            const cacheKeys = Array.from(new Set([
              originalUid,
              resolvedId,
              profile.uid,
              mapFirebaseUidToUuid(originalUid),
              mapFirebaseUidToUuid(resolvedId),
              mapFirebaseUidToUuid(profile.uid)
            ].filter(Boolean)));

            for (const cacheKey of cacheKeys) {
              const cached = localStorage.getItem(`potenciar_result_${cacheKey}`);
              if (cached) {
                latestResult = JSON.parse(cached);
                break;
              }
            }
          } catch (e) {
            console.error("Failed to parse cached result:", e);
          }
        }

        if (latestResult) {
          setMyResult(latestResult);
        }

        setStep('menu');
      } else {
        // No profile found, force onboarding
        setStep('onboarding');
      }
    } catch (err) {
      console.error("Erro no carregamento do perfil do usuário:", err);
      // Fallback to onboarding
      setStep('onboarding');
    } finally {
      setLoading(false);
    }
  };

  // Listen to Auth State changes (both Firebase Google Auth and Supabase Password Auth)
  useEffect(() => {
    let active = true;

    // 1. Firebase Auth listener
    const unsubscribeFb = onAuthStateChanged(fbAuth, async (fbUser) => {
      if (!active) return;
      if (fbUser) {
        console.log('[DEBUG AUTH] Usuário detectado via Firebase Auth:', fbUser.email);
        await handleAuthUser({ id: fbUser.uid, email: fbUser.email, origin: 'firebase' });
      } else {
        // If Firebase user leaves, check if there is an active Supabase session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await handleAuthUser({ id: session.user.id, email: session.user.email, origin: 'supabase' });
        } else {
          await handleAuthUser(null);
        }
      }
    });

    // 2. Supabase Auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;
      const fbUser = fbAuth.currentUser;
      if (fbUser) {
        // Firebase has priority if active
        await handleAuthUser({ id: fbUser.uid, email: fbUser.email, origin: 'firebase' });
      } else {
        await handleAuthUser(session?.user ? { id: session.user.id, email: session.user.email, origin: 'supabase' } : null);
      }
    });

    return () => {
      active = false;
      unsubscribeFb();
      subscription.unsubscribe();
    };
  }, []);

  // Post Login Account Actions
  const handleAuthSuccess = async (uid: string, email: string) => {
    // Session state change will run handleAuthUser
  };

  // Onboarding Complete
  const handleOnboardingComplete = (profile: Usuario) => {
    setUserProfile(profile);
    setStep('menu');
  };

  // Questionnaire completed
  const handleQuestionnaireFinished = (result: Resultado) => {
    setMyResult(result);
    setStep('dashboard'); // Redirect immediately to view new results
  };

  // Optional: let user re-take test by updating step safely
  const handleRetakeTest = () => {
    setStep('questionnaire');
  };

  const [activeDashboardTab, setActiveDashboardTab] = useState<'individual' | 'team'>('individual');

  const isAdmin = userProfile?.role === 'admin' || userProfile?.email === 'nomura.eduardo@gmail.com';

  if (loading || step === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center space-y-4" id="global-loader-container">
        <div className="flex items-center justify-center w-12 h-12 bg-[#112363] rounded-2xl shadow-md">
          <RefreshCw className="w-6 h-6 text-white animate-spin" />
        </div>
        <p className="text-xs font-bold text-[#112363]/80 uppercase tracking-widest text-center animate-pulse">
          Potenciar Socioestilo &bull; Carregando
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans selection:bg-[#D80E2A]/20" id="app-root-wrapper">

      {/* Fixed Navigation Header */}
      <Header
        userEmail={currentUser?.email || null}
        userName={userProfile?.nome || null}
        isAdmin={isAdmin}
        onLogout={async () => {
          await supabase.auth.signOut();
          try {
            await fbSignOut(fbAuth);
          } catch (e) {
            console.warn("Erro ao fazer logout no Firebase:", e);
          }
          setCurrentUser(null);
          setUserProfile(null);
          setMyResult(null);
          setAdminViewUser(null);
          setAdminSelectedCompany(null);
          setStep('auth');
        }}
        onGoHome={() => {
          if (userProfile) {
            setAdminViewUser(null);
            setAdminSelectedCompany(null);
            setStep('menu');
          }
        }}
        onGoToAdmin={() => {
          setAdminViewUser(null);
          setAdminSelectedCompany(null);
          setStep('admin');
        }}
      />

      {/* Main Body Layout */}
      <main className="flex-1 py-10 px-4 md:px-0 flex items-center justify-center" id="main-content-layout">

        {step === 'auth' && (
          <AuthScreen onSuccess={handleAuthSuccess} />
        )}

        {step === 'onboarding' && currentUser && (
          <OnboardingScreen
            uid={currentUser.uid}
            email={currentUser.email || ''}
            onComplete={handleOnboardingComplete}
          />
        )}

        {step === 'menu' && userProfile && (
          <MenuScreen
            usuario={userProfile}
            myResult={myResult}
            isAdmin={isAdmin}
            onSelectStep={(targetStep) => {
              setAdminViewUser(null);
              setAdminSelectedCompany(null);
              setStep(targetStep);
            }}
            onGoToAdmin={() => {
              setAdminViewUser(null);
              setAdminSelectedCompany(null);
              setStep('admin');
            }}
          />
        )}

        {step === 'questionnaire' && userProfile && (
          <div className="w-full max-w-4xl mx-auto flex flex-col space-y-4">
            <div className="px-4 w-full flex justify-start">
              <button
                onClick={() => setStep('menu')}
                className="flex items-center space-x-1.5 bg-white border border-gray-200 text-xxs font-bold text-[#112363] px-3.5 py-2 rounded-xl shadow-2xs hover:border-[#112363] active:scale-98 transition-all cursor-pointer animate-fade-in"
                id="btn-questionnaire-back-menu"
              >
                <span>&larr; Sair e Salvar</span>
              </button>
            </div>
            <QuestionnaireScreen
              usuario={userProfile}
              onFinish={handleQuestionnaireFinished}
              onGoBack={() => setStep('menu')}
            />
          </div>
        )}

        {step === 'dashboard' && (
          (adminViewUser && adminViewUser.user && adminViewUser.result) ||
          (!adminViewUser && userProfile && myResult) ||
          (adminSelectedCompany)
        ) && (() => {
          const activeUser = adminSelectedCompany
            ? { nome: 'Administrador', empresa_nome: adminSelectedCompany.nome, email: '' } as Usuario
            : (adminViewUser ? adminViewUser.user : userProfile!);

          const activeResult = adminSelectedCompany
            ? null
            : (adminViewUser ? adminViewUser.result : myResult!);

          return (
            <div className="w-full flex flex-col space-y-6">

              {/* Quick action bar to re-take questionnaire or go back */}
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 animate-fade-in print:hidden">
                <button
                  onClick={() => {
                    if (adminSelectedCompany) {
                      setAdminSelectedCompany(null);
                      setStep('admin');
                    } else if (adminViewUser) {
                      setAdminViewUser(null);
                      setStep('admin');
                    } else {
                      setStep('menu');
                    }
                  }}
                  className="flex items-center justify-center space-x-1.5 bg-white border border-gray-200 text-xxs font-bold text-[#112363] px-3.5 py-2.5 sm:py-2 rounded-xl shadow-2xs hover:border-[#112363] active:scale-98 transition-all cursor-pointer"
                  id="btn-dashboard-back-menu"
                >
                  <span>&larr; {(adminViewUser || adminSelectedCompany) ? 'Voltar ao Portal de Gestão' : 'Painel Principal'}</span>
                </button>

                {!adminViewUser && !adminSelectedCompany && activeDashboardTab === 'individual' && (
                  <button
                    onClick={handleRetakeTest}
                    className="flex items-center justify-center space-x-2 bg-[#112363] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xs hover:bg-[#112363]/90 active:scale-98 transition-all cursor-pointer"
                    id="btn-retake-test"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>Responder Novamente</span>
                  </button>
                )}
              </div>

              <DashboardScreen
                usuario={activeUser}
                myResult={activeResult}
                adminSelectedCompanyId={adminSelectedCompany?.id}
                adminSelectedCompanyName={adminSelectedCompany?.nome}
                onTabChange={setActiveDashboardTab}
              />
            </div>
          );
        })()}

        {step === 'admin' && userProfile && isAdmin && (
          <AdminScreen
            currentUserProfile={userProfile}
            onGoBack={() => setStep('menu')}
            onViewUserReport={(user, result) => {
              setAdminViewUser({ user, result });
              setStep('dashboard');
            }}
            onViewCompanyDashboard={(companyId, companyName) => {
              setAdminSelectedCompany({ id: companyId, nome: companyName });
              setStep('dashboard');
            }}
          />
        )}

      </main>

      {/* Humble professional brand footer */}
      <footer className="py-3 text-center border-t border-gray-100 bg-white" id="main-footer">
        <p className="text-xxs text-gray-400">
          &copy; {new Date().getFullYear()} Potenciar Consultores Associados. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}
