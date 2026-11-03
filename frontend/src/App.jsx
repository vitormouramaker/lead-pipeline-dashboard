import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PieChart, Pie, Cell, Legend, ResponsiveContainer, LabelList } from 'recharts';
import './App.css';
import CsvUploadComponent from './CsvUploadComponent'; // Importa o novo componente
import Login from './Login';
import { api, API_URL, getToken, setToken, setUnauthorizedHandler, formatDate, toInputDate } from './api';

// Vocabulário da planilha. As opções dos selects juntam estas com as que já
// existem no banco, para o formulário funcionar também com o banco vazio.
const STATUS_LEAD_OPCOES = ['🟡 EM ANÁLISE', '🟢 QUALIFICADO', '🔵 FOLLOW-UP', '🔴 NÃO QUALIFICADO'];
const STATUS_VENDA_OPCOES = ['⏳ AGUARDANDO', '💰 EM NEGOCIAÇÃO', '✅ VENDEU', '❌ NÃO VENDEU'];

const mergeOptions = (base, extra) => [...new Set([...base, ...extra])];

// Cores do gráfico de pizza por status do lead
const COLORS_CHART = {
  '🟡 EM ANÁLISE': '#FFBB28',
  '🟢 QUALIFICADO': '#82ca9d',
  '🔵 FOLLOW-UP': '#0088FE',
  '🔴 NÃO QUALIFICADO': '#FF0000',
  'Outro': '#000000' // Cor padrão para status não mapeados
};

function Dashboard({ user, onLogout }) {
  const [leads, setLeads] = useState([]); // Todos os leads do banco de dados
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  

  // Estados para filtros e busca
  const [filters, setFilters] = useState({
    status_do_lead: '',
    responsavel: '',
    curso: '',
    instagram_de_origem: '',
  });
  const [search, setSearch] = useState('');

  // Estados para paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [showUploadModal, setShowUploadModal] = useState(false);
  // Estados para o modal de adicionar/editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentLead, setCurrentLead] = useState(null); // Lead sendo editado, ou null para novo
  const [formError, setFormError] = useState('');
  const [formData, setFormData] = useState({
    data: '',
    curso: '',
    instagram_de_origem: '',
    nome: '',
    telefone: '',
    email: '',
    status_do_lead: '',
    status_de_venda: '',
    valor_da_venda: '',
    data_do_follow_up: '',
    responsavel: '',
    observacoes: '',
  });

  // Estados para opções de filtros dinâmicos
  const [filterOptions, setFilterOptions] = useState({
    status_do_lead: [],
    status_de_venda: [],
    responsavel: [],
    curso: [],
    instagram_de_origem: [],
  });

  // Efeito para carregar leads e opções de filtro ao montar o componente
  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/leads');
      setLeads(response.data);

      // Extrair opções únicas para os filtros
      const uniqueStatus = [...new Set(response.data.map(lead => lead.status_do_lead))].filter(Boolean);
      const uniqueResponsaveis = [...new Set(response.data.map(lead => lead.responsavel))].filter(Boolean);
      const uniqueCursos = [...new Set(response.data.map(lead => lead.curso))].filter(Boolean);
      const uniqueInstagram = [...new Set(response.data.map(lead => lead.instagram_de_origem))].filter(Boolean);
      const uniqueStatusVenda = [...new Set(response.data.map(lead => lead.status_de_venda))].filter(Boolean);

      setFilterOptions({
        status_do_lead: uniqueStatus,
        status_de_venda: uniqueStatusVenda,
        responsavel: uniqueResponsaveis,
        curso: uniqueCursos,
        instagram_de_origem: uniqueInstagram,
      });

      setError(null);
    } catch (err) {
      console.error('Erro ao buscar leads:', err);
      setError('Não foi possível carregar os leads. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Lógica de filtragem e busca
  // filteredLeads: Contém TODOS os leads após aplicar filtros e busca (usado para cards e gráfico)
  const filteredLeads = useMemo(() => {
    let currentFilteredLeads = leads;

    // Aplicar filtros
    if (filters.status_do_lead) {
      currentFilteredLeads = currentFilteredLeads.filter(lead => lead.status_do_lead === filters.status_do_lead);
    }
    if (filters.responsavel) {
      currentFilteredLeads = currentFilteredLeads.filter(lead => lead.responsavel === filters.responsavel);
    }
    if (filters.curso) {
      currentFilteredLeads = currentFilteredLeads.filter(lead => lead.curso === filters.curso);
    }
    if (filters.instagram_de_origem) {
      currentFilteredLeads = currentFilteredLeads.filter(lead => lead.instagram_de_origem === filters.instagram_de_origem);
    }

    // Aplicar busca por nome
    if (search) {
      currentFilteredLeads = currentFilteredLeads.filter(lead => 
          lead.nome_do_lead?.toLowerCase().includes(search.toLowerCase())
      );
    }

    return currentFilteredLeads;
  }, [leads, filters, search]);

  // Resetar a página atual para 1 sempre que os filtros ou busca mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, search]);

  // currentPageLeads: Contém apenas os leads da página atual (usado para a tabela)
  const currentPageLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredLeads.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredLeads, currentPage, itemsPerPage]);

  // Cálculo de estatísticas para os cards (baseado em filteredLeads)
  const stats = useMemo(() => {
    const total = filteredLeads.length;
    const novo = filteredLeads.filter(l => l.status_do_lead === '🔵 FOLLOW-UP').length;
    const qualificado = filteredLeads.filter(l => l.status_do_lead === '🟢 QUALIFICADO').length;
    const emNegociacao = filteredLeads.filter(l => l.status_do_lead === '🟡 EM ANÁLISE').length;
    const perdido = filteredLeads.filter(l => l.status_do_lead === '🔴 NÃO QUALIFICADO').length;

    return { total, novo, qualificado, emNegociacao, perdido };
  }, [filteredLeads]);

  // Dados para o gráfico de pizza (baseado em filteredLeads)
  const pieChartData = useMemo(() => {
    const statusCounts = filteredLeads.reduce((acc, lead) => {
      acc[lead.status_do_lead] = (acc[lead.status_do_lead] || 0) + 1;
      return acc;
    }, {});
    return Object.keys(statusCounts).map(status => ({
      name: status,
      value: statusCounts[status],
      color: COLORS_CHART[status] || COLORS_CHART['Outro'],
	  percent: Math.round(((statusCounts[status] / filteredLeads.length)) * 100) + '%'
    }));
  }, [filteredLeads]);

  // Lógica de paginação
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);

  const handlePageChange = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  // Handlers para filtros e busca
  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
  };

  // Handlers para o modal
  const openModal = (lead = null) => {
    setCurrentLead(lead);
    setFormError('');
    if (lead) {
      // Formatar data para YYYY-MM-DD para input type="date"
      const formattedData = toInputDate(lead.data);
      const formattedFollowUp = toInputDate(lead.data_do_follow_up);

      // Campos nulos viram '' para os inputs continuarem controlados.
      const filled = Object.fromEntries(Object.entries(lead).map(([key, value]) => [key, value ?? '']));
      setFormData({
        ...filled,
        data: formattedData,
        data_do_follow_up: formattedFollowUp,
        nome: lead.nome_do_lead // Mapear nome_do_lead para nome para o formulário
      });
    } else {
      setFormData({
        data: new Date().toLocaleDateString('en-CA'), // Data atual (fuso local) por padrão
        curso: '',
        instagram_de_origem: '',
        nome: '',
        telefone: '',
        email: '',
        status_do_lead: STATUS_LEAD_OPCOES[0], // Padrão para novo lead
        status_de_venda: STATUS_VENDA_OPCOES[0],
        valor_da_venda: '',
        data_do_follow_up: '',
        responsavel: '',
        observacoes: '',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentLead(null);
    setFormData({});
  };

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        nome_do_lead: formData.nome, // Mapear nome de volta para nome_do_lead para a API
        valor_da_venda: parseFloat(formData.valor_da_venda) || 0, // Garantir que é número
      };

      if (currentLead) {
        await api.put(`/leads/${currentLead.id}`, payload);
      } else {
        await api.post('/leads', payload);
      }
      fetchLeads(); // Recarrega os leads após a operação
      closeModal();
    } catch (err) {
      console.error('Erro ao salvar lead:', err);
      // Erro de validação (telefone obrigatório, e-mail/telefone repetido) fica no modal.
      const data = err.response?.data;
      const detail = data?.error || (Array.isArray(data?.errors) ? data.errors.join(', ') : null);
      if (detail) setFormError(detail);
      else setError('Não foi possível salvar o lead. Verifique os dados e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Tem certeza que deseja deletar este lead?')) {
      setLoading(true);
      try {
        await api.delete(`/leads/${id}`);
        fetchLeads(); // Recarrega os leads
      } catch (err) {
        console.error('Erro ao deletar lead:', err);
        setError('Não foi possível deletar o lead. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading && leads.length === 0) {
    return <div className="loading-container">Carregando leads...</div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <p>{error}</p>
        <button className="add-lead-button" onClick={() => { setError(null); fetchLeads(); }}>Tentar novamente</button>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>Painel de Leads</h1>
        <button className="add-lead-button" onClick={() => openModal()}>Adicionar Novo Lead</button>
        <button className="upload-button" onClick={() => setShowUploadModal(true)}>Upload de Planilha</button>
        <div className="session-info">
          <span>{user?.nome}</span>
          <button className="logout-button" onClick={onLogout}>Sair</button>
        </div>
      </header>

      <div className="stats-cards">
        <div className="card total">
          <h3>Total de Leads</h3>
          <p>{stats.total}</p>
        </div>
        <div className="card novo">
          <h3>🔵 FOLLOW-UP</h3>
          <p>{stats.novo}</p>
        </div>
        <div className="card qualificado">
          <h3>🟢 QUALIFICADOS</h3>
          <p>{stats.qualificado}</p>
        </div>
        <div className="card em-negociacao">
          <h3>🟡 EM ANÁLISE</h3>
          <p>{stats.emNegociacao}</p>
        </div>
        <div className="card perdido">
          <h3>🔴 NÃO QUALIFICADO</h3>
          <p>{stats.perdido}</p>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="filters-and-chart">
          <div className="filters-section">
            <input
              type="text"
              placeholder="Buscar por Nome..."
              value={search}
              onChange={handleSearchChange}
              className="search-input"
            />
            <select name="status_do_lead" value={filters.status_do_lead} onChange={handleFilterChange}>
              <option value="">Todos os Status</option>
              {filterOptions.status_do_lead.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <select name="responsavel" value={filters.responsavel} onChange={handleFilterChange}>
              <option value="">Todos os Responsáveis</option>
              {filterOptions.responsavel.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <select name="curso" value={filters.curso} onChange={handleFilterChange}>
              <option value="">Todos os Cursos</option>
              {filterOptions.curso.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <select name="instagram_de_origem" value={filters.instagram_de_origem} onChange={handleFilterChange}>
              <option value="">Todas as Origens</option>
              {filterOptions.instagram_de_origem.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          <div className="chart-section">
            <h2>Distribuição de Leads por Status</h2>
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
				    <LabelList dataKey="percent" position="right" style={{fontsize: "10px" }} />
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="no-data-message">Nenhum dado para o gráfico com os filtros aplicados.</p>
            )}
          </div>
        </div>

        <div className="leads-table-section">
          <h2>Leads Encontrados ({filteredLeads.length})</h2>
          {currentPageLeads.length > 0 ? (
            <>
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Nome</th>
                      <th>Curso</th>
                      <th>Origem Instagram</th>
                      <th>Telefone</th>
                      <th>Email</th>
                      <th>Status Lead</th>
                      <th>Status Venda</th>
                      <th>Valor Venda</th>
                      <th>Próximo Follow-up</th>
                      <th>Responsável</th>
                      <th>Observações</th>
                      <th>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentPageLeads.map(lead => (
                      <tr key={lead.id}>
                        <td>{formatDate(lead.data)}</td>
                        <td>{lead.nome_do_lead}</td>
                        <td>{lead.curso}</td>
                        <td>{lead.instagram_de_origem}</td>
                        <td>{lead.telefone}</td>
                        <td>{lead.email}</td>
                        <td><span className={`status-badge ${(lead.status_do_lead || '').substring(3).toLowerCase().replace(/\s/g, '-')}`}>{lead.status_do_lead}</span></td>
                        <td>{lead.status_de_venda}</td>
                        <td>{lead.valor_da_venda ? `R$ ${parseFloat(lead.valor_da_venda).toFixed(2)}` : ''}</td>
                        <td>{formatDate(lead.data_do_follow_up)}</td>
                        <td>{lead.responsavel}</td>
                        <td>{lead.observacoes}</td>
                        <td className="actions-cell">
                          <button className="edit-button" onClick={() => openModal(lead)} title="Editar" aria-label="Editar lead">
                            <i className="fas fa-edit"></i>
                          </button>
                          <button className="delete-button" onClick={() => handleDelete(lead.id)} title="Deletar" aria-label="Deletar lead">
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="pagination">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Anterior
                </button>
                <span>Página {currentPage} de {totalPages}</span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || totalPages === 0}
                >
                  Próxima Página
                </button>
              </div>
            </>
          ) : (
            <p className="no-data-message">Nenhum lead encontrado com os filtros aplicados.</p>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>{currentLead ? 'Editar Lead' : 'Adicionar Novo Lead'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Data:</label>
                <input type="date" name="data" value={formData.data} onChange={handleFormChange} required />
              </div>
              <div className="form-group">
                <label>Nome:</label>
                <input type="text" name="nome" value={formData.nome} onChange={handleFormChange} required />
              </div>
              <div className="form-group">
                <label>Curso:</label>
                <input type="text" name="curso" value={formData.curso} onChange={handleFormChange} />
              </div>
              <div className="form-group">
                <label>Instagram de Origem:</label>
                <input type="text" name="instagram_de_origem" value={formData.instagram_de_origem} onChange={handleFormChange} />
              </div>
              <div className="form-group">
                <label>Telefone:</label>
                <input type="text" name="telefone" value={formData.telefone} onChange={handleFormChange} required />
              </div>
              <div className="form-group">
                <label>Email:</label>
                <input type="email" name="email" value={formData.email} onChange={handleFormChange} />
              </div>
              <div className="form-group">
                <label>Status do Lead:</label>
                <select name="status_do_lead" value={formData.status_do_lead} onChange={handleFormChange} required>
                  <option value="">Selecione</option>
                  {mergeOptions(STATUS_LEAD_OPCOES, filterOptions.status_do_lead).map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Status de Venda:</label>
                <select name="status_de_venda" value={formData.status_de_venda} onChange={handleFormChange}>
                  <option value="">Selecione</option>
                  {mergeOptions(STATUS_VENDA_OPCOES, filterOptions.status_de_venda).map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Valor da Venda:</label>
                <input type="number" name="valor_da_venda" value={formData.valor_da_venda} onChange={handleFormChange} step="0.01" />
              </div>
              <div className="form-group">
                <label>Data do Follow-up:</label>
                <input type="date" name="data_do_follow_up" value={formData.data_do_follow_up} onChange={handleFormChange} />
              </div>
              <div className="form-group">
                <label>Responsável:</label>
                <input type="text" name="responsavel" value={formData.responsavel} onChange={handleFormChange} />
              </div>
              <div className="form-group">
                <label>Observações:</label>
                <textarea name="observacoes" value={formData.observacoes} onChange={handleFormChange}></textarea>
              </div>
              {formError && <p className="form-error">{formError}</p>}
              <div className="modal-actions">
                <button type="submit" className="save-button">Salvar</button>
                <button type="button" className="cancel-button" onClick={closeModal}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Novo componente de upload */}
      <CsvUploadComponent
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onUploadSuccess={fetchLeads} // Recarrega os leads após o upload
          apiUrl={`${API_URL}/upload-csv`}
          token={getToken()}
      />
    </div>
  );
}

// Sessão: sem token mostra o login; com token confere em /auth/me e abre o painel.
function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(() => Boolean(getToken()));

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) return;
    api
      .get('/auth/me')
      .then((response) => setUser(response.data.user))
      .catch(() => logout())
      .finally(() => setChecking(false));
  }, [logout]);

  if (checking) {
    return <div className="loading-container">Carregando...</div>;
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return <Dashboard user={user} onLogout={logout} />;
}

export default App;