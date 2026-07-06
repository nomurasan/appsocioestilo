import React from 'react';
import { LogOut, User, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Logo from './Logo';

interface HeaderProps {
  userEmail: string | null;
  userName: string | null;
  isAdmin?: boolean;
  onLogout: () => void;
  onGoHome?: () => void;
  onGoToAdmin?: () => void;
}

export default function Header({ userEmail, userName, isAdmin, onLogout, onGoHome, onGoToAdmin }: HeaderProps) {
  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      onLogout();
    } catch (err) {
      console.error("Erro ao deslogar:", err);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-xs print:hidden" id="main-header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        
        {/* Brand Logo & Name */}
        <Logo size="sm" onClick={onGoHome} />

        {/* User Stats / Actions */}
        {userEmail && (
          <div className="flex items-center space-x-4" id="header-user-actions">
            
            {isAdmin && onGoToAdmin && (
              <button
                onClick={onGoToAdmin}
                className="bg-[#D80E2A] text-white hover:bg-[#D80E2A]/90 text-[10px] font-black uppercase px-3 cursor-pointer py-1.5 rounded-full shadow-sm flex items-center space-x-1 border border-red-200 transition-colors"
                id="btn-header-admin"
              >
                <Shield className="w-3 h-3 text-white" />
                <span>ADMIN</span>
              </button>
            )}

            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-[#112363]" id="user-display-name">
                {userName || 'Avaliando...'}
              </span>
              <span className="text-[10px] text-gray-500" id="user-display-email">
                {userEmail}
              </span>
            </div>
            
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-[#112363]">
              <User className="w-4 h-4" />
            </div>

            <button
              onClick={handleSignOut}
              className="group flex items-center justify-center p-2 rounded-lg text-gray-400 hover:text-[#D80E2A] hover:bg-gray-50 transition-colors"
              title="Sair do aplicativo"
              id="btn-logout"
            >
              <LogOut className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
