import React, { useState, useEffect } from 'react';
import { 
  Building2, Users, Settings, Trash2, PlusCircle, Edit3, Check, X, 
  ChevronRight, ArrowLeft, RefreshCw, Shield, AlertTriangle, 
  UserPlus, CheckCircle2, Sliders, ShieldAlert, FileText, Search, Grid, Eye
} from 'lucide-react';
import { Empresa, Usuario, Resultado, Scores, STYLE_NAMES } from '../types';
import { 
  listarEmpresas, criarEmpresa, atualizarEmpresa, excluirEmpresa,
  listarUsuarios, buscarUsuario, atualizarUsuario, excluirUsuario,
  listarResultados, buscarResultado, criarResultado, atualizarResultado, excluirResultado
} from '../lib/supabase';

interface AdminScreenProps {
  currentUserProfile: Usuario;
  onGoBack: () => void;
  onViewUserReport?: (user: Usuario, result: Resultado) => void;
  onViewCompanyDashboard?: (companyId: string, companyName: string) => void;
}

export default function AdminScreen({ 
  currentUserProfile, 
  onGoBack, 
  onViewUserReport,
  onViewCompanyDashboard
}: AdminScreenProps) {
  // Database States
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [resultados, setResultados] = useState<Resultado[]>([]);
  
  // Loading & UI States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [searchUserQuery, setSearchUserQuery] = useState('');
  
  // Modals / Action States
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  
  const [editingCompany, setEditingCompany] = useState<Empresa | null>(null);
  const [editCompanyName, setEditCompanyName] = useState('');
  
  const [editingUser, setEditingUser] = useState<Usuario | null>(null);
  const [editUserNome, setEditUserNome] = useState('');
  const [editUserEmpresaId, setEditUserEmpresaId] = useState('');
  const [editUserRole, setEditUserRole] = useState('');
  const [editUserScores, setEditUserScores] = useState<Scores>({
    Assertivo: 0,
    Participativo: 0,
    Integrador: 0,
    Analitico: 0
  });
  const [hasSocioestiloResult, setHasSocioestiloResult] = useState(false);
  const [savingUserEdit, setSavingUserEdit] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    type: 'empresa' | 'colaborador' | 'resultado';
    id: string;
    nome: string;
  } | null>(null);

  // Fetch all database records
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Companies with RPC
      const empresasList = await listarEmpresas();
      // Sort alphabetically
      empresasList.sort((a, b) => a.nome.localeCompare(b.nome));
      setEmpresas(empresasList);

      // 2. Fetch Users with RPC
      const usuariosList = await listarUsuarios();
      
      // Auto-upgrade nomura email if present on list
      const nomuraUser = usuariosList.find(u => u.email === 'nomura.eduardo@gmail.com');
      if (nomuraUser && nomuraUser.role !== 'admin') {
        try {
          await atualizarUsuario(nomuraUser.uid, nomuraUser.email, nomuraUser.nome, nomuraUser.empresa_id, 'admin', nomuraUser.perfil_dominante || null);
          nomuraUser.role = 'admin';
        } catch (roleErr) {
          console.error("Erro auto-promovendo nomura para admin via RPC:", roleErr);
        }
      }
      
      usuariosList.sort((a, b) => a.nome.localeCompare(b.nome));
      setUsuarios(usuariosList);

      // 3. Fetch Results with RPC
      const resultadosList = await listarResultados();
      setResultados(resultadosList);
    } catch (err) {
      console.error("Erro ao carregar dados administrativos via RPC:", err);
      setError("Não foi possível sincronizar os registros do banco com suas credenciais atuais.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Display success message for a brief duration
  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => {
      setSuccessMsg(null);
    }, 4500);
  };

  // --- BUSINESS LOGIC: COMPANIES ---
  
  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNome = newCompanyName.trim();
    if (!cleanNome) return;

    // Check if company already exists
    if (empresas.some(emp => emp.nome.toLowerCase() === cleanNome.toLowerCase())) {
      setError("Já existe uma empresa cadastrada com esse nome.");
      return;
    }

    try {
      await criarEmpresa(cleanNome);
      triggerSuccess(`Empresa "${cleanNome}" registrada com sucesso!`);
      setShowAddCompanyModal(false);
      setNewCompanyName('');
      fetchData();
    } catch (err) {
      console.error(err);
      setError("Erro ao tentar registrar empresa.");
    }
  };

  const handleStartEditCompany = (company: Empresa) => {
    setEditingCompany(company);
    setEditCompanyName(company.nome);
  };

  const handleSaveCompanyEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;
    const cleanNome = editCompanyName.trim();
    if (!cleanNome) return;

    try {
      // Update the Company via RPC
      await atualizarEmpresa(editingCompany.id, cleanNome);
      triggerSuccess(`Empresa atualizada para "${cleanNome}".`);
      setEditingCompany(null);
      fetchData();
    } catch (err) {
      console.error(err);
      setError("Erro ao salvar edições da empresa.");
    }
  };

  const handleDeleteCompany = (companyId: string, companyNome: string) => {
    setDeleteConfirmation({
      type: 'empresa',
      id: companyId,
      nome: companyNome
    });
  };


  // --- BUSINESS LOGIC: USERS & ADEQUAÇÕES ---

  const normalizeText = (value: any) => {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  };

  const normalizeDominantProfile = (value: any): keyof Scores | '' => {
    const normalized = normalizeText(value);
    if (!normalized) return '';
    if (normalized.includes('conserv') || normalized.includes('agreg') || normalized.includes('integ') || normalized.includes('amav')) return 'Integrador';
    if (normalized.includes('assert') || normalized.includes('direto')) return 'Assertivo';
    if (normalized.includes('particip') || normalized.includes('express')) return 'Participativo';
    if (normalized.includes('analit')) return 'Analitico';
    return '';
  };

  const getResultMetadata = (result: Resultado) => {
    const anyResult = result as any;
    return anyResult.metadata || anyResult.raw_payload?.metadata || anyResult.ai_insights?.metadata || {};
  };

  const resultBelongsToUser = (result: Resultado, user: Usuario) => {
    const anyResult = result as any;
    const ids = [result.id_usuario, anyResult.user_id, anyResult.uid].filter(Boolean).map(String);
    if (ids.includes(String(user.uid))) return true;

    const metadata = getResultMetadata(result);
    const resultEmail = metadata.email || metadata.userEmail || metadata.user_email || anyResult.email || anyResult.user_email;
    if (resultEmail && normalizeText(resultEmail) === normalizeText(user.email)) return true;

    const resultName = result.nome_usuario || result.user_name || metadata.userName || metadata.name || metadata.nome;
    const sameName = resultName && normalizeText(resultName) === normalizeText(user.nome);
    if (!sameName) return false;

    const resultCompany = result.empresa_nome || result.company_name || metadata.companyName || metadata.empresa;
    return !resultCompany || !user.empresa_nome || normalizeText(resultCompany) === normalizeText(user.empresa_nome);
  };

  const getLatestResultForUser = (user: Usuario) => {
    return resultados
      .filter(r => resultBelongsToUser(r, user))
      .sort((a, b) => b.data_conclusao.localeCompare(a.data_conclusao))[0];
  };

  const handleStartEditUser = (user: Usuario) => {
    setEditingUser(user);
    setEditUserNome(user.nome);
    setEditUserEmpresaId(user.empresa_id);
    setEditUserRole(user.role || 'user');

    // Check if this user already has an active score result
    const userResult = getLatestResultForUser(user);
    if (userResult) {
      setHasSocioestiloResult(true);
      const sAny = userResult.scores as any;
      setEditUserScores({
        Assertivo: userResult.scores.Assertivo ?? sAny.Direto ?? 0,
        Participativo: userResult.scores.Participativo ?? sAny.Expressivo ?? 0,
        Integrador: userResult.scores.Integrador ?? sAny.integrador ?? sAny.Amavel ?? sAny.conservador_agregador ?? sAny["Conservador agregador"] ?? 0,
        Analitico: userResult.scores.Analitico ?? sAny["Analítico"] ?? sAny.analitico ?? 0
      });
    } else {
      setHasSocioestiloResult(false);
      setEditUserScores({
        Assertivo: 0,
        Participativo: 0,
        Integrador: 0,
        Analitico: 0
      });
    }
  };

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setSavingUserEdit(true);
    setError(null);

    try {
      // 1. Update user profile via RPC: atualizar_usuario
      await atualizarUsuario(
        editingUser.uid,
        editingUser.email,
        editUserNome,
        editUserEmpresaId,
        editUserRole,
        editingUser.perfil_dominante || null
      );

      // 2. Adjust or Create scores if desired
      const existingResult = getLatestResultForUser(editingUser);
      
      if (hasSocioestiloResult) {
        // Validate scores
        const { Assertivo, Participativo, Integrador, Analitico } = editUserScores;
        if (Assertivo < 0 || Participativo < 0 || Integrador < 0 || Analitico < 0) {
          setError("As pontuações de socioestilo devem ser válidas e maiores ou iguais a 0.");
          setSavingUserEdit(false);
          return;
        }

        let dominantStyle: keyof Scores = 'Assertivo';
        let maxScore = -1;
        (Object.keys(editUserScores) as Array<keyof Scores>).forEach((key) => {
          if (editUserScores[key] > maxScore) {
            maxScore = editUserScores[key];
            dominantStyle = key;
          }
        });

        if (existingResult) {
          // Update the existing result via RPC: atualizar_resultado
          const resultId = (existingResult as any).id || (existingResult as any).id_resultado;
          await atualizarResultado(
            resultId,
            editUserScores,
            dominantStyle,
            existingResult.ai_insights || null
          );
        } else {
          // Create a new result record via RPC: criar_resultado
          await criarResultado(
            editingUser.uid,
            editUserEmpresaId,
            editUserScores,
            dominantStyle,
            null,
            undefined,
            editingUser.nome,
            editingUser.empresa_nome
          );
        }
      } else {
        // If they unchecked it, delete user's score via RPC: excluir_resultado
        if (existingResult) {
          const resultId = (existingResult as any).id || (existingResult as any).id_resultado;
          await excluirResultado(resultId);
        }
      }

      triggerSuccess(`Adequação realizada para o colaborador "${editUserNome}". Base cadastral e socioestilo sincronizados.`);
      setEditingUser(null);
      fetchData();
    } catch (err) {
      console.error(err);
      setError("Erro ao tentar salvar adequações do colaborador.");
    } finally {
      setSavingUserEdit(false);
    }
  };

  const handleDeleteUser = (uid: string, nome: string) => {
    setDeleteConfirmation({
      type: 'colaborador',
      id: uid,
      nome: nome
    });
  };

  const handleDeleteAttempt = (attempt: Resultado, userNome: string) => {
    const attemptDate = new Date(attempt.data_conclusao).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    setDeleteConfirmation({
      type: 'resultado',
      id: (attempt as any).id || (attempt as any).id_resultado || '',
      nome: `Resultado de ${userNome} em ${attemptDate}`
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) return;
    const { type, id, nome } = deleteConfirmation;
    setDeleteConfirmation(null); // Clear confirmation
    setLoading(true);
    try {
      if (type === 'empresa') {
        // Find company users
        const companyUsers = usuarios.filter(u => u.empresa_id === id);
        
        // Find company or user results
        const companyResults = resultados.filter(r => r.empresa_id === id || companyUsers.some(u => u.uid === r.id_usuario));
        
        // 1. Delete all results for this company's users
        for (const r of companyResults) {
          const resultId = (r as any).id || (r as any).id_resultado;
          if (resultId) {
            await excluirResultado(resultId);
          }
        }
        
        // 2. Delete all users belonging to this company
        for (const u of companyUsers) {
          await excluirUsuario(u.uid);
        }

        // 3. Delete company itself
        await excluirEmpresa(id);
        
        triggerSuccess(`Empresa "${nome}" e todos os seus colaboradores/resultados foram excluídos com sucesso (modo cascata).`);
        if (selectedCompanyId === id) {
          setSelectedCompanyId(null);
        }
      } else if (type === 'resultado') {
        // Delete a specific result via RPC
        await excluirResultado(id);
        triggerSuccess(`Resultado de teste excluído do banco de dados com sucesso.`);
      } else {
        // 1. Delete user from Supabase via RPC: excluir_usuario
        await excluirUsuario(id);

        // 2. Delete any results belonging to the user via RPC: excluir_resultado
        const userResults = resultados.filter(r => r.id_usuario === id);
        for (const r of userResults) {
          const resultId = (r as any).id || (r as any).id_resultado;
          await excluirResultado(resultId);
        }

        triggerSuccess(`Colaborador "${nome}" removido do sistema com sucesso.`);
      }
      fetchData();
    } catch (err) {
      console.error(err);
      setError(
        type === 'empresa' 
          ? "Erro ao apagar empresa." 
          : type === 'resultado' 
            ? "Erro ao tentar excluir este resultado do banco de dados." 
            : "Erro ao tentar remover o colaborador."
      );
      setLoading(false);
    }
  };

  const handleToggleUserRole = async (user: Usuario) => {
    const isCurrentlyAdmin = user.role === 'admin' || user.email === 'nomura.eduardo@gmail.com';
    const newRole = isCurrentlyAdmin ? 'user' : 'admin';
    const roleLabel = newRole === 'admin' ? 'Administrador' : 'Colaborador';
    
    try {
      await atualizarUsuario(
        user.uid,
        user.email,
        user.nome,
        user.empresa_id,
        newRole,
        user.perfil_dominante || null
      );
      triggerSuccess(`Função do colaborador "${user.nome}" alterada para ${roleLabel} com sucesso.`);
      fetchData();
    } catch (err) {
      console.error("Erro ao alterar privilégios do usuário:", err);
      setError("Erro ao tentar alterar privilégios do colaborador.");
    }
  };

  const handleViewUserReportInternal = (user: Usuario, specificResult?: Resultado) => {
    const result = specificResult || getLatestResultForUser(user);
    if (result && onViewUserReport) {
      onViewUserReport(user, result);
    } else {
      alert("Este colaborador ainda não respondeu ou concluiu o Teste de Socioestilo.");
    }
  };

  // Helper to find dominant style for a user (considering latest result)
  const getUserDominantStyle = (user: Usuario) => {
    const result = getLatestResultForUser(user);
    if (!result) return "Não Respondeu";

    const profileFromResult = normalizeDominantProfile(result.perfil_dominante);
    if (profileFromResult) {
      const profileScore = result.scores?.[profileFromResult] || 0;
      return `${STYLE_NAMES[profileFromResult] || profileFromResult}${profileScore > 0 ? ` (${profileScore}pts)` : ''}`;
    }

    const { scores } = result;
    let dominant: keyof Scores = 'Assertivo';
    let max = -1;
    (Object.keys(scores) as Array<keyof Scores>).forEach(key => {
      if (scores[key] > max) {
        max = scores[key];
        dominant = key;
      }
    });
    return `${STYLE_NAMES[dominant] || dominant} (${max}pts)`;
  };

  // Filters
  const filteredUsers = usuarios.filter((user) => {
    const matchesSearch = user.nome.toLowerCase().includes(searchUserQuery.toLowerCase()) || 
                          user.email.toLowerCase().includes(searchUserQuery.toLowerCase());
    const matchesCompany = selectedCompanyId ? user.empresa_id === selectedCompanyId : true;
    return matchesSearch && matchesCompany;
  });

  const selectedComp = empresas.find(e => e.id === selectedCompanyId);
  const selectedCompNome = selectedComp ? selectedComp.nome : '';

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-8 space-y-8 animate-fade-in pb-12" id="admin-panel-portal">
      
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-100 pb-6 gap-4">
        <div>
          <button
            onClick={onGoBack}
            className="flex items-center space-x-1.5 text-xs text-gray-500 hover:text-[#112363] font-bold mb-3 cursor-pointer"
            id="admin-btn-back"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Meu Dashboard</span>
          </button>
          <div className="flex items-center space-x-3">
            <span className="p-1 px-2.5 rounded-full bg-red-100 text-[#D80E2A] text-[9px] font-black uppercase tracking-widest">
              Nível Administrador / Consultor
            </span>
            <div className="flex items-center space-x-1 text-gray-400">
              <Shield className="w-4 h-4 text-[#D80E2A]" />
              <span className="text-xxs font-medium text-gray-500">Acesso Restrito</span>
            </div>
          </div>
          <h2 className="text-3xl font-black text-[#112363] uppercase tracking-tight mt-1.5" id="admin-title">
            Portal de Gestão & Adequações
          </h2>
          <p className="text-xs text-gray-500 mt-1" id="admin-subtitle">
            Configure as empresas parceiras da Potenciar, gerencie novos acessos e faça correções pontuais nos perfis e scores comportamentais dos colaboradores.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            onClick={fetchData}
            className="flex items-center justify-center p-3 text-[#112363] border border-gray-200 hover:border-gray-300 bg-white rounded-xl active:scale-95 transition-all cursor-pointer"
            title="Sincronizar dados"
            id="admin-btn-sync"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowAddCompanyModal(true)}
            className="flex items-center space-x-2 bg-[#D80E2A] hover:bg-[#D80E2A]/90 text-white font-extrabold text-xs py-3.5 px-6 rounded-xl transition-all shadow-md active:scale-98 cursor-pointer"
            id="admin-btn-register-company"
          >
            <PlusCircle className="w-4.5 h-4.5" />
            <span>REGISTRAR EMPRESA</span>
          </button>
        </div>
      </div>

      {/* Global Message Handling Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-800 flex items-start space-x-3 text-xs" id="admin-error-banner">
          <AlertTriangle className="w-5 h-5 text-[#D80E2A] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-extrabold block">Pendência Sistêmica</span>
            <p className="opacity-90 leading-relaxed font-semibold">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-100 text-green-800 flex items-start space-x-3 text-xs animate-slide-in" id="admin-success-banner">
          <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-extrabold block">Operação com Sucesso</span>
            <p className="opacity-95 text-gray-700 leading-relaxed font-medium">{successMsg}</p>
          </div>
        </div>
      )}

      {/* Loading container skeleton */}
      {loading && empresas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-white border border-gray-100 rounded-3xl" id="admin-skeleton-loader">
          <RefreshCw className="w-8 h-8 text-[#112363] animate-spin" />
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest animate-pulse">Sincronizando Informações Corporativas...</p>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="space-y-4 animate-fade-in" id="section-empresas">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-[#112363]/5 text-[#112363] rounded-lg">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-[#112363] uppercase tracking-wider">
                    Empresas & Turmas Cadastradas ({empresas.length})
                  </h4>
                  <p className="text-xxs text-gray-500">
                    Selecione uma organização para filtrar o banco de colaboradores abaixo.
                  </p>
                </div>
              </div>

              {selectedCompanyId && (
                <button
                  onClick={() => setSelectedCompanyId(null)}
                  className="text-xxs font-extrabold text-[#D80E2A] hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <span>Limpar Filtro de Seleção</span>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {empresas.length === 0 ? (
              <div className="p-12 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center space-y-4">
                <Building2 className="w-10 h-10 text-gray-300" />
                <div>
                  <h5 className="font-bold text-[#112363] text-sm">Nenhuma empresa mapeada</h5>
                  <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                    Ainda não existem empresas registradas. Clique no botão abaixo para cadastrar a primeira organização parceira.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddCompanyModal(true)}
                  className="bg-[#D80E2A] hover:bg-[#D80E2A]/90 text-white font-extrabold text-xs py-2.5 px-5 rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  Cadastrar Primeira Empresa
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" id="dashboard-company-grid">
                {/* Special Dashed Plus Card to register new company */}
                <div 
                  onClick={() => setShowAddCompanyModal(true)}
                  className="rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/25 hover:bg-gray-50/85 p-5 flex flex-col items-center justify-center text-center space-y-3 cursor-pointer hover:border-[#112363] hover:shadow-sm transition-all duration-200 min-h-[170px]"
                  id="card-add-new-company"
                >
                  <div className="p-3 bg-red-50 text-[#D80E2A] rounded-full shrink-0">
                    <PlusCircle className="w-5.5 h-5.5" />
                  </div>
                  <div>
                    <h5 className="font-extrabold text-[#112363] text-sm">Cadastrar Nova Empresa</h5>
                    <p className="text-[11px] text-gray-400 mt-1">Clique para registrar uma nova organização</p>
                  </div>
                </div>

                {empresas.map((emp) => {
                  const isSelected = selectedCompanyId === emp.id;
                  const companyUserCount = usuarios.filter(u => u.empresa_id === emp.id).length;
                  
                  // Only count results with valid scores (at least one > 0)
                  const companyResultCount = resultados.filter(e => {
                    if (e.empresa_id !== emp.id) return false;
                    if (!e.scores || typeof e.scores !== 'object') {
                      if (isSelected && process.env.NODE_ENV === 'development') {
                        console.warn('[AdminScreen] Result filtered: invalid scores', { 
                          id: e.id, 
                          scores: e.scores, 
                          scoresType: typeof e.scores 
                        });
                      }
                      return false;
                    }
                    const scoreValues = Object.values(e.scores) as number[];
                    const hasValidScores = scoreValues.length > 0 && scoreValues.some(s => typeof s === 'number' && s > 0);
                    if (!hasValidScores && isSelected && process.env.NODE_ENV === 'development') {
                      console.warn('[AdminScreen] Result filtered: no valid scores > 0', { 
                        id: e.id, 
                        scores: e.scores,
                        scoreValues,
                        empresa_id: e.empresa_id
                      });
                    }
                    return hasValidScores;
                  }).length;

                  return (
                    <div 
                      key={emp.id}
                      className={`rounded-2xl border-2 p-5 space-y-4 relative overflow-hidden transition-all duration-200 flex flex-col justify-between ${
                        isSelected 
                          ? 'bg-[#112363] text-white border-[#112363] shadow-lg shadow-blue-900/10' 
                          : 'bg-white text-gray-800 border-gray-150 hover:border-gray-300 shadow-sm'
                      }`}
                    >
                      {/* Top action header for the card */}
                      <div className="flex items-center justify-between">
                        <div className={`p-2.5 rounded-lg shrink-0 ${isSelected ? 'bg-white/10 text-white' : 'bg-orange-50 text-orange-600'}`}>
                          <Building2 className="w-5 h-5" />
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleStartEditCompany(emp)}
                            className={`p-1.5 rounded-md transition-colors ${
                              isSelected ? 'text-white/70 hover:text-white hover:bg-white/15' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                            }`}
                            title="Editar Nome da Empresa"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => handleDeleteCompany(emp.id, emp.nome)}
                            className={`p-1.5 rounded-md transition-colors ${
                              isSelected ? 'text-white/70 hover:text-red-300 hover:bg-white/15' : 'text-gray-400 hover:text-[#D80E2A] hover:bg-red-50'
                            }`}
                            title="Remover Empresa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Info labels */}
                      <div className="space-y-1">
                        <h5 className={`font-black tracking-tight line-clamp-1 ${isSelected ? 'text-white text-sm' : 'text-[#112363] text-sm'}`}>
                          {emp.nome}
                        </h5>
                        <code className={`block font-mono text-[9px] px-1.5 py-0.5 rounded uppercase ${
                          isSelected ? 'bg-white/10 text-gray-200' : 'bg-gray-100 text-gray-500'
                        } py-0.5 max-w-fit`}>
                          {emp.id}
                        </code>
                      </div>

                      {/* Stats numbers inside card */}
                      <div className="flex items-center space-x-6 pt-2 text-xxs font-medium">
                        <div>
                          <span className={`${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>Mapeados :</span>{' '}
                          <strong className={isSelected ? 'text-white' : 'text-gray-800'}>{companyUserCount}</strong>
                        </div>
                        <div>
                          <span className={`${isSelected ? 'text-gray-300' : 'text-gray-400'}`}>Respondido :</span>{' '}
                          <strong className={isSelected ? 'text-white' : 'text-gray-800'}>{companyResultCount}</strong>
                        </div>
                      </div>

                      {/* Actions grid for organization */}
                      <div className="grid grid-cols-1 gap-2 pt-1">
                        {/* Confirm filter trigger click */}
                        <button
                          onClick={() => {
                            setSelectedCompanyId(isSelected ? null : emp.id);
                          }}
                          className={`w-full flex items-center justify-center space-x-1.5 py-2 px-4 rounded-xl text-xxs font-black transition-all ${
                            isSelected 
                              ? 'bg-white text-[#112363] hover:bg-gray-50/90'
                              : 'bg-gray-50 hover:bg-gray-100 text-[#112363] border border-gray-150'
                          } cursor-pointer active:scale-98`}
                        >
                          <span>{isSelected ? 'OCULTAR COLABORADORES' : 'VER COLABORADORES'}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>

                        {/* View Company Dashboard */}
                        {onViewCompanyDashboard && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewCompanyDashboard(emp.id, emp.nome);
                            }}
                            className={`w-full flex items-center justify-center space-x-1.5 py-2 px-4 rounded-xl text-xxs font-extrabold transition-all ${
                              isSelected
                                ? 'bg-white/10 text-white hover:bg-white/15'
                                : 'bg-[#112363]/5 hover:bg-[#112363]/10 text-[#112363] border border-[#112363]/8'
                            } cursor-pointer active:scale-98`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>VISUALIZAR DASHBOARD DA EMPRESA</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {selectedCompanyId && (
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8 space-y-6 animate-fade-in" id="section-usuarios">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-[#D80E2A]/5 text-[#D80E2A] rounded-lg">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base font-black text-[#112363] uppercase tracking-wider">
                    Colaboradores de: <span className="text-[#D80E2A]">{selectedCompNome}</span> ({filteredUsers.length})
                  </h4>
                  <p className="text-xxs text-gray-500 font-semibold">
                    Consulte os usuários vinculados para visualizar relatórios ou fazer adequações de socioestilo.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 select-none">
                <button
                  type="button"
                  onClick={() => setSelectedCompanyId(null)}
                  className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl border border-gray-200 hover:border-red-200 text-[#D80E2A] hover:bg-red-50/50 text-xxs font-black cursor-pointer transition-all uppercase tracking-wider"
                >
                  <X className="w-4 h-4" />
                  <span>FECHAR LISTA</span>
                </button>
              </div>

              {/* Dynamic search bar */}
              <div className="relative max-w-sm w-full">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Pesquisar por nome ou e-mail..."
                  value={searchUserQuery}
                  onChange={(e) => setSearchUserQuery(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 pl-10 pr-4 text-xs text-gray-800 focus:outline-[#112363] placeholder-gray-400 focus:ring-1 focus:ring-[#112363]/25 transition-all"
                  id="admin-search-user"
                />
                {searchUserQuery && (
                  <button
                    onClick={() => setSearchUserQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* List Table of users */}
            {filteredUsers.length === 0 ? (
              <div className="p-12 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-xs text-gray-400">Nenhum colaborador encontrado correspondendo à busca ou filtro selecionado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-150" id="table-user-list">
                <table className="min-w-full divide-y divide-gray-150 text-left">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-4 text-[10px] font-extrabold text-[#112363] uppercase tracking-wider">Colaborador</th>
                      <th scope="col" className="px-6 py-4 text-[10px] font-extrabold text-[#112363] uppercase tracking-wider">E-mail</th>
                      <th scope="col" className="px-6 py-4 text-[10px] font-extrabold text-[#112363] uppercase tracking-wider">Empresa / Turma</th>
                      <th scope="col" className="px-6 py-4 text-[10px] font-extrabold text-[#112363] uppercase tracking-wider">Perfil Dominante</th>
                      <th scope="col" className="px-6 py-4 text-[10px] font-extrabold text-[#112363] uppercase tracking-wider">Função</th>
                      <th scope="col" className="px-6 py-4 text-right text-[10px] font-extrabold text-[#112363] uppercase tracking-wider">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {filteredUsers.map((user) => {
                      const userAttempts = resultados
                        .filter(r => resultBelongsToUser(r, user))
                        .sort((a, b) => b.data_conclusao.localeCompare(a.data_conclusao));
                      const userResult = userAttempts[0];
                      const isUserAdmin = user.role === 'admin' || user.email === 'nomura.eduardo@gmail.com';
                      
                      return (
                        <tr key={user.uid} className="hover:bg-gray-50/50 transition-colors">
                          {/* Name / Block */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-xs font-black text-[#112363] block">
                              {user.nome}
                            </span>
                          </td>

                          {/* Email */}
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600 font-medium font-mono">
                            {user.email}
                          </td>

                          {/* Company / Turma */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-xs font-bold text-gray-800 block">
                              {user.empresa_nome}
                            </span>
                            <span className="text-[9px] text-[#D80E2A] font-semibold bg-red-50 px-1.5 py-0.5 rounded font-mono uppercase">
                              
                            </span>
                          </td>

                          {/* Dominant profile */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
                              userResult 
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
                                : 'bg-gray-50 text-gray-500 border-gray-150'
                            }`}>
                              {getUserDominantStyle(user)}
                            </span>
                          </td>

                          {/* Role Tag */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md ${
                              isUserAdmin ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {isUserAdmin ? 'Administrador' : 'Colaborador'}
                            </span>
                          </td>

                          {/* Quick action buttons & historical selector */}
                          <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-medium">
                            <div className="flex flex-col items-end gap-2">
                              <div className="space-x-1.5 flex items-center">
                                {userResult && onViewUserReport && (
                                  <button
                                    onClick={() => handleViewUserReportInternal(user, userResult)}
                                    className="inline-flex items-center space-x-1 p-2 bg-[#112363]/5 hover:bg-[#112363]/10 text-[#112363] rounded-lg transition-colors cursor-pointer"
                                    title="Visualizar Relatório de Socioestilo mais recente"
                                  >
                                    <Eye className="w-4 h-4" />
                                    <span className="text-[10px] font-extrabold">Ver Último</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => handleToggleUserRole(user)}
                                  className={`inline-flex items-center p-2 rounded-lg border transition-all cursor-pointer ${
                                    isUserAdmin 
                                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-800' 
                                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                                  }`}
                                  title={isUserAdmin ? "Mudar função para Colaborador" : "Mudar função para Administrador"}
                                  id={`btn-toggle-role-${user.uid}`}
                                >
                                  {isUserAdmin ? (
                                    <Shield className="w-4 h-4 fill-amber-500 text-amber-800" />
                                  ) : (
                                    <ShieldAlert className="w-4 h-4 text-slate-400" />
                                  )}
                                </button>

                                <button
                                  onClick={() => handleDeleteUser(user.uid, user.nome)}
                                  className="inline-flex items-center p-2 bg-red-50 hover:bg-red-100 text-[#D80E2A] rounded-lg transition-colors cursor-pointer"
                                  title="Remover Colaborador do Banco"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>

                              {/* Historical Attempts Selector */}
                              {userAttempts.length >= 1 && (
                                <div className="text-right mt-1" id={`attempts-wrapper-${user.uid}`}>
                                  <span className="text-[8px] text-gray-400 font-bold block mb-1">
                                    Histórico de Tentativas ({userAttempts.length}):
                                  </span>
                                  <div className="flex flex-wrap gap-1.5 justify-end max-w-[250px]">
                                    {userAttempts.map((attempt, index) => {
                                      const attemptDate = new Date(attempt.data_conclusao).toLocaleDateString('pt-BR', {
                                        day: '2-digit',
                                        month: '2-digit'
                                      });
                                      return (
                                        <div 
                                          key={(attempt as any).id || (attempt as any).id_resultado || index} 
                                          className="inline-flex items-center bg-gray-50 border border-gray-150 rounded shadow-2xs overflow-hidden"
                                        >
                                          <button
                                            onClick={() => handleViewUserReportInternal(user, attempt)}
                                            className="text-[8.5px] font-extrabold text-gray-700 px-2 py-0.5 hover:bg-[#112363] hover:text-white transition-all cursor-pointer font-mono flex items-center space-x-1 animate-fade-in"
                                            title={`Ver relatório finalizado em ${new Date(attempt.data_conclusao).toLocaleString('pt-BR')}`}
                                            id={`btn-attempt-${user.uid}-${index}`}
                                          >
                                            <span>
                                              {index === 0 ? `T.Recente (${attemptDate})` : `T.${userAttempts.length - index} (${attemptDate})`}
                                            </span>
                                          </button>
                                          <button
                                            onClick={() => handleDeleteAttempt(attempt, user.nome)}
                                            className="p-1.5 text-[#D80E2A] hover:bg-red-50 hover:text-red-700 transition-colors border-l border-gray-150 cursor-pointer flex items-center justify-center"
                                            title="Excluir este resultado específico"
                                          >
                                            <Trash2 className="w-2.5 h-2.5" />
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}
        </div>
      )}

      {/* --- MODAL DIALOGS --- */}

      {/* 1. Modal: Register/Add Company */}
      {showAddCompanyModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative overflow-hidden">
            <button
              onClick={() => setShowAddCompanyModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-4 mb-6">
              <span className="text-[9px] bg-red-50 text-[#D80E2A] px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
                Novo Registro
              </span>
              <h4 className="text-xl font-extrabold text-[#112363]">Registrar Nova Empresa</h4>
              <p className="text-xs text-gray-500">
                Uma vez cadastrada, a nova empresa estará disponível para os colaboradores escolherem ou se vincularem automaticamente durante o onboarding.
              </p>
            </div>

            <form onSubmit={handleAddCompany} className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-extrabold text-[#112363] uppercase tracking-wider">
                  Nome Completo da Organização
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Coca-Cola Distribuidora"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm focus:outline-[#112363]"
                />
              </div>

              <div className="flex space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddCompanyModal(false)}
                  className="flex-1 border border-gray-200 text-xs font-bold text-gray-500 py-3 rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#112363] hover:bg-[#112363]/90 text-white text-xs font-extrabold py-3 rounded-xl cursor-pointer"
                >
                  Registrar Organização
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Edit Company Name */}
      {editingCompany && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative overflow-hidden">
            <button
              onClick={() => setEditingCompany(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="space-y-4 mb-6">
              <span className="text-[9px] bg-red-50 text-[#D80E2A] px-2.5 py-1 rounded-full font-black uppercase tracking-wider">
                Configurações da Empresa
              </span>
              <h4 className="text-xl font-extrabold text-[#112363]">Editar Organização</h4>
              <p className="text-xs text-gray-500">
                Atenção: Ao renomear a empresa, o nome será atualizado em cascata para todos os colaboradores vinculados a ela.
              </p>
            </div>

            <form onSubmit={handleSaveCompanyEdit} className="space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-extrabold text-[#112363] uppercase tracking-wider">
                  Código Identificador
                </label>
                <code className="block bg-gray-50 border border-gray-150 p-2 text-xs font-mono rounded text-gray-500 font-bold select-all">
                  {editingCompany.id}
                </code>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-extrabold text-[#112363] uppercase tracking-wider">
                  Nome da Organização
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nome da empresa..."
                  value={editCompanyName}
                  onChange={(e) => setEditCompanyName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 px-4 text-sm focus:outline-[#112363]"
                />
              </div>

              <div className="flex space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingCompany(null)}
                  className="flex-1 border border-gray-200 text-xs font-bold text-gray-500 py-3 rounded-xl hover:bg-gray-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-[#112363] hover:bg-[#112363]/90 text-white text-xs font-extrabold py-3 rounded-xl cursor-pointer"
                >
                  Salvar Ajustes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal: Custom Delete Confirmation (Safe from sandboxed iframe constraints) */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl relative overflow-hidden ring-1 ring-black/5">
            <button
              onClick={() => setDeleteConfirmation(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center space-y-4 mb-6 pt-2">
              <div className="p-3.5 bg-red-50 text-[#D80E2A] rounded-full">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-lg font-black text-[#112363]">Confirmação de Exclusão</h4>
                <div className="text-xs text-gray-500 leading-relaxed px-1">
                  {deleteConfirmation.type === 'empresa' ? (
                    <div>
                      Deseja realmente remover a empresa <strong className="text-gray-700">"{deleteConfirmation.nome}"</strong> do cadastro?
                      <span className="block mt-2 text-[11px] text-[#D80E2A] font-extrabold bg-red-50/50 p-2 text-left rounded-lg">
                        Atenção (Modo Cascata): Essa ação é irreversível e excluirá definitivamente TODOS os colaboradores associados a esta organização e seus respectivos resultados de teste socioestilo.
                      </span>
                    </div>
                  ) : deleteConfirmation.type === 'resultado' ? (
                    <div>
                      Deseja realmente desconsiderar e excluir este resultado do banco de dados?
                      <strong className="block text-gray-700 mt-2 text-sm bg-gray-50 p-2.5 rounded-lg border border-gray-100 italic">
                        "{deleteConfirmation.nome}"
                      </strong>
                      <span className="block mt-3 text-[11px] text-[#D80E2A] font-bold bg-red-50/50 p-2 rounded-lg">
                        Essa operação é definitiva e removerá este relatório do histórico. O colaborador ainda permanecerá cadastrado.
                      </span>
                    </div>
                  ) : (
                    <div>
                      Deseja realmente remover o colaborador <strong className="text-gray-700">"{deleteConfirmation.nome}"</strong> do sistema?
                      <span className="block mt-2 text-[11px] text-[#D80E2A] font-extrabold bg-red-50/50 p-2 rounded-lg">
                        Essa operação é irreversível e apagará DEFINITIVAMENTE todo o perfil cadastral e resultados de socioestilo relacionados.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmation(null)}
                className="flex-1 border border-gray-200 text-xs font-bold text-gray-500 py-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 bg-[#D80E2A] hover:bg-[#D80E2A]/90 text-white text-xs font-black py-3 rounded-xl cursor-pointer transition-colors shadow-sm"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal removed as per user request to directly toggle roles with a single click */}

    </div>
  );
}
