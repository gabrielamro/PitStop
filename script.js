// Configuração do Supabase
const SUPABASE_URL = "https://mzahiyhvxxgegyyfmmbl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16YWhpeWh2eHhnZWd5eWZtbWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ0MzUzMzIsImV4cCI6MjA2MDAxMTMzMn0.IBwErJNVkeNUggCxXzZ0MsDldTRqAlqTAcWoxkX5gsU";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Dados dos produtos
const produtos = {
  "4 - Cervejas LONGNECK": ["Coronita", "Heineken", "Stella Artois"],
  "5 - REFRIGERANTES": ["Guaraná Antartica 2l", "Coca-Cola 2L", "Sprite 2L"],
  "9- ENERGÉTICOS LATA": ["RedBull", "RedBull Pitaya", "RedBull Tropical", "TNT"]
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  const hoje = new Date().toISOString().split('T')[0];
  document.getElementById('data-registro').value = hoje;
  document.getElementById('data-comparacao').value = hoje;
  atualizarDataAtual();
});

// Funções básicas
function mostrarSecao(secao) {
  document.querySelectorAll('.container').forEach(el => el.style.display = 'none');
  document.getElementById(secao).style.display = 'block';
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

function atualizarDataAtual() {
  document.getElementById('current-date').textContent = new Date().toLocaleDateString('pt-BR');
}

async function testarConexao() {
  try {
    const { error } = await db.from('estoque').select('*').limit(1);
    alert(error ? '❌ Erro na conexão' : '✅ Conexão OK!');
  } catch (error) {
    alert('⚠️ Falha na conexão: ' + error.message);
  }
}

// Registro de estoque
async function filtrarProdutos() {
  const categoria = document.getElementById('categoria').value;
  const data = document.getElementById('data-registro').value;
  const lista = document.getElementById('produtos-lista');
  
  lista.innerHTML = '<div class="loading">Carregando...</div>';
  
  try {
    // Busca estoque atual
    let query = db.from('estoque').select('produto, quantidade').eq('data', data);
    
    if (categoria) {
      query = query.in('produto', produtos[categoria]);
    }
    
    const { data: estoques, error } = await query;
    
    if (error) throw error;
    
    let html = `
      <table class="produto-tabela">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Categoria</th>
            <th>Estoque Atual</th>
            <th>Alteração</th>
          </tr>
        </thead>
        <tbody>`;
    
    // Organiza por categoria
    for (const [cat, prods] of Object.entries(produtos)) {
      if (categoria && cat !== categoria) continue;
      
      html += `<tr><td colspan="4" class="categoria-header">${cat}</td></tr>`;
      
      for (const produto of prods) {
        const registro = estoques?.find(e => e.produto === produto);
        const quantidade = registro?.quantidade || 0;
        
        html += `
          <tr>
            <td>${produto}</td>
            <td>${cat}</td>
            <td>
              <input type="number" id="input-${produto.replace(/\s+/g, '-')}" 
                     value="${quantidade}" min="0" class="input-estoque">
            </td>
            <td>
              <button onclick="salvarEstoque('${produto.replace(/'/g, "\\'")}', '${cat.replace(/'/g, "\\'")}')">
                Salvar
              </button>
            </td>
          </tr>`;
      }
    }
    
    html += '</tbody></table>';
    lista.innerHTML = html;
    
  } catch (error) {
    lista.innerHTML = `<p class="error">Erro ao carregar: ${error.message}</p>`;
  }
}

async function salvarEstoque(produto, categoria) {
  const data = document.getElementById('data-registro').value;
  const input = document.getElementById(`input-${produto.replace(/\s+/g, '-')}`);
  const quantidade = parseInt(input.value);
  
  if (isNaN(quantidade) || quantidade < 0) {
    alert('Valor inválido! Digite um número positivo.');
    return;
  }
  
  try {
    // Verifica se já existe registro
    const { data: existente, error: erroBusca } = await db
      .from('estoque')
      .select('id')
      .eq('produto', produto)
      .eq('data', data)
      .maybeSingle();
    
    if (erroBusca) throw erroBusca;
    
    let resultado;
    if (existente) {
      resultado = await db
        .from('estoque')
        .update({ quantidade })
        .eq('id', existente.id);
    } else {
      resultado = await db
        .from('estoque')
        .insert([{ produto, categoria, data, quantidade }]);
    }
    
    if (resultado.error) throw resultado.error;
    
    input.style.backgroundColor = '#e8f5e9';
    setTimeout(() => input.style.backgroundColor = '', 1000);
    
  } catch (error) {
    console.error('Erro ao salvar:', error);
    alert(`Erro ao salvar: ${error.message}`);
  }
}

// Comparação de estoque
async function carregarComparacao() {
  const data = document.getElementById('data-comparacao').value;
  const resultado = document.getElementById('resultado-comparacao');
  
  resultado.innerHTML = '<div class="loading">Carregando...</div>';
  
  try {
    // Busca a data selecionada e a anterior
    const { data: registros, error } = await db
      .from('estoque')
      .select('produto, categoria, quantidade, data')
      .or(`data.eq.${data},data.eq.${getDataAnterior(data)}`)
      .order('data', { ascending: false });
    
    if (error) throw error;
    
    // Organiza os dados
    const hoje = registros.filter(r => r.data === data);
    const ontem = registros.filter(r => r.data === getDataAnterior(data));
    
    let html = `
      <table class="produto-tabela">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Categoria</th>
            <th>Estoque (${formatarData(data)})</th>
            <th>Estoque (${formatarData(getDataAnterior(data))})</th>
            <th>Diferença</th>
            <th>Vendido</th>
          </tr>
        </thead>
        <tbody>`;
    
    for (const [cat, prods] of Object.entries(produtos)) {
      html += `<tr><td colspan="6" class="categoria-header">${cat}</td></tr>`;
      
      for (const produto of prods) {
        const registroHoje = hoje.find(r => r.produto === produto);
        const registroOntem = ontem.find(r => r.produto === produto);
        
        const qtdHoje = registroHoje?.quantidade || 0;
        const qtdOntem = registroOntem?.quantidade || 0;
        const diferenca = qtdOntem - qtdHoje;
        
        html += `
          <tr class="${diferenca < 0 ? 'negativo' : ''}">
            <td>${produto}</td>
            <td>${cat}</td>
            <td>${qtdHoje}</td>
            <td>${qtdOntem}</td>
            <td>${diferenca}</td>
            <td>${diferenca > 0 ? diferenca : '-'}</td>
          </tr>`;
      }
    }
    
    html += '</tbody></table>';
    resultado.innerHTML = html;
    
  } catch (error) {
    resultado.innerHTML = `<p class="error">Erro ao carregar comparação: ${error.message}</p>`;
  }
}

// Detecção de desvios
async function verificarDesvios() {
  const tolerancia = parseInt(document.getElementById('tolerancia').value) || 0;
  const alertasDiv = document.getElementById('lista-alertas');
  
  alertasDiv.innerHTML = '<div class="loading">Analisando...</div>';
  
  try {
    // Busca os últimos 7 dias para análise
    const { data: registros, error } = await db
      .from('estoque')
      .select('produto, categoria, quantidade, data')
      .order('data', { ascending: false })
      .limit(100); // Ajuste conforme necessário
    
    if (error) throw error;
    
    // Agrupa por produto
    const produtosMap = {};
    registros.forEach(r => {
      if (!produtosMap[r.produto]) {
        produtosMap[r.produto] = [];
      }
      produtosMap[r.produto].push(r);
    });
    
    let html = '<div class="alertas-container">';
    let totalAlertas = 0;
    
    for (const [produto, registros] of Object.entries(produtosMap)) {
      // Ordena por data
      registros.sort((a, b) => new Date(b.data) - new Date(a.data));
      
      // Verifica variações suspeitas
      const alertasProduto = [];
      
      for (let i = 0; i < registros.length - 1; i++) {
        const hoje = registros[i];
        const ontem = registros[i + 1];
        
        if (hoje.data === ontem.data) continue;
        
        const diferenca = ontem.quantidade - hoje.quantidade;
        const vendasEsperadas = calcularVendasEsperadas(produto, hoje.data);
        
        if (diferenca < -tolerancia) {
          alertasProduto.push({
            data: hoje.data,
            diferenca,
            vendasEsperadas
          });
        }
      }
      
      if (alertasProduto.length > 0) {
        totalAlertas++;
        html += `
          <div class="alerta-item">
            <h3>${produto}</h3>
            <ul>
              ${alertasProduto.map(a => `
                <li>
                  <strong>${formatarData(a.data)}</strong>:
                  Diferença de ${-a.diferenca} unidades
                  ${a.vendasEsperadas ? `(Vendas esperadas: ~${a.vendasEsperadas})` : ''}
                </li>
              `).join('')}
            </ul>
          </div>`;
      }
    }
    
    html += '</div>';
    
    if (totalAlertas === 0) {
      html = '<p class="success">Nenhum desvio significativo encontrado!</p>';
    } else {
      html = `<h2>${totalAlertas} alerta(s) encontrado(s)</h2>` + html;
    }
    
    alertasDiv.innerHTML = html;
    
  } catch (error) {
    alertasDiv.innerHTML = `<p class="error">Erro na análise: ${error.message}</p>`;
  }
}

// Funções auxiliares
function getDataAnterior(data) {
  const date = new Date(data);
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

function formatarData(data) {
  return new Date(data).toLocaleDateString('pt-BR');
}

function calcularVendasEsperadas(produto, data) {
  // Aqui você pode implementar lógica baseada em histórico
  // Exemplo simples: média de vendas dos últimos 7 dias
  return null; // Retorna null por enquanto (implemente conforme sua necessidade)
}