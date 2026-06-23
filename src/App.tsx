import React, { useState, useEffect } from 'react';
import { supabase, buscarUsuario, listarResultadosUsuario, atualizarUsuario, mapFirebaseUidToUuid, syncFirebaseUserWithSupabaseAuth } from './lib/supabase';
import { auth as fbAuth, signOut as fbSignOut } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { Usuario, Resultado } from './types';

// Core layout & panels
import Header from './components/Header';
import AuthScreen from './components/AuthScreen';
import OnboardingScreen from './components/OnboardingScreen';
import ChatbotScreen from './components/ChatbotScreen';
import DashboardScreen from './components/DashboardScreen';
import MenuScreen from './components/MenuScreen';
import AdminScreen from './components/AdminScreen';
import { RefreshCw, LayoutDashboard, Home } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<{ uid: string; email: string } | null>(null);
  const [userProfile, setUserProfile] = useState<Usuario | null>(null);
  const [myResult, setMyResult] = useState<Resultado | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'loading' | 'auth' | 'onboarding' | 'menu' | 'chatbot' | 'dashboard' | 'admin'>('loading');
  const [adminViewUser, setAdminViewUser] = useState<{ user: Usuario; result: Resultado } | null>(null);
  const [adminSelectedCompany, setAdminSelectedCompany] = useState<{ id: string; nome: string } | null>(null);

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
      // Fetch user profile with RPC buscar_usuario
      let profile = await buscarUsuario(resolvedId);

      // Self-healing migration for legacy users: if no profile exists for resolvedId but one exists for the old mapped Firebase ID, migrate it.
      if (!profile && userObj.origin === 'firebase') {
        const legacyUid = mapFirebaseUidToUuid(userObj.id);
        profile = await buscarUsuario(legacyUid);
        if (profile) {
          try {
            await supabase.from('usuarios').update({ uid: resolvedId }).eq('uid', legacyUid);
            profile.uid = resolvedId;
            console.log(`[DEBUG AUTH] Migrated public.usuarios uid from legacy ${legacyUid} to resolvedId ${resolvedId}`);
          } catch (migErr) {
            console.error("Failed to migrate legacy uid:", migErr);
          }
        }
      }
      
      if (profile) {
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
          const resultsList = await listarResultadosUsuario(resolvedId);
          if (resultsList && resultsList.length > 0) {
            resultsList.sort((a, b) => b.data_conclusao.localeCompare(a.data_conclusao));
            latestResult = resultsList[0];
          }
        } catch (dbErr) {
          console.warn("Could not load results from database, trying local cache:", dbErr);
        }

        if (!latestResult) {
          try {
            const cached = localStorage.getItem(`potenciar_result_${resolvedId}`);
            if (cached) {
              latestResult = JSON.parse(cached);
            } else if (userObj.origin === 'firebase') {
              // Try with legacy key as fallback
              const legacyUid = mapFirebaseUidToUuid(userObj.id);
              const legacyCached = localStorage.getItem(`potenciar_result_${legacyUid}`);
              if (legacyCached) {
                latestResult = JSON.parse(legacyCached);
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

  // Chatbot test completed
  const handleChatbotFinished = (result: Resultado) => {
    setMyResult(result);
    setStep('dashboard'); // Redirect immediately to view new results
  };

  // Optional: let user re-take test by updating step safely
  const handleRetakeTest = () => {
    setStep('chatbot');
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

        {step === 'chatbot' && userProfile && (
          <div className="w-full max-w-4xl mx-auto flex flex-col space-y-4">
            <div className="px-4 w-full flex justify-start">
              <button
                onClick={() => setStep('menu')}
                className="flex items-center space-x-1.5 bg-white border border-gray-200 text-xxs font-bold text-[#112363] px-3.5 py-2 rounded-xl shadow-2xs hover:border-[#112363] active:scale-98 transition-all cursor-pointer animate-fade-in"
                id="btn-chatbot-back-menu"
              >
                <span>&larr; Sair e Salvar</span>
              </button>
            </div>
            <ChatbotScreen
              usuario={userProfile}
              onFinish={handleChatbotFinished}
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
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex justify-between items-center gap-4 animate-fade-in print:hidden">
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
                  className="flex items-center space-x-1.5 bg-white border border-gray-200 text-xxs font-bold text-[#112363] px-3.5 py-2 rounded-xl shadow-2xs hover:border-[#112363] active:scale-98 transition-all cursor-pointer"
                  id="btn-dashboard-back-menu"
                >
                  <span>&larr; {(adminViewUser || adminSelectedCompany) ? 'Voltar ao Portal de Gestão' : 'Painel Principal'}</span>
                </button>

                {!adminViewUser && !adminSelectedCompany && activeDashboardTab === 'individual' && (
                  <button
                    onClick={handleRetakeTest}
                    className="flex items-center space-x-2 bg-[#112363] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-2xs hover:bg-[#112363]/90 active:scale-98 transition-all cursor-pointer"
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
