const SUPABASE_URL = "https://mzahiyhvxxgegyyfmmbl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16YWhpeWh2eHhnZWd5eWZtbWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ0MzUzMzIsImV4cCI6MjA2MDAxMTMzMn0.IBwErJNVkeNUggCxXzZ0MsDldTRqAlqTAcWoxkX5gsU";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let produtosPorCategoria = {};

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  sidebar.classList.toggle('active');
  overlay.classList.toggle('active');
}

function mostrarSecao(secaoId) {
  document.querySelectorAll('.section').forEach(section => {
    section.classList.remove('active');
  });
  document.getElementById(secaoId).classList.add('active');

  document.querySelectorAll('.sidebar li').forEach(li => {
    li.classList.remove('active');
  });
  document.querySelector(`.sidebar li[onclick="mostrarSecao('${secaoId}')"]`).classList.add('active');

  if (window.innerWidth <= 768) {
    toggleSidebar();
  }
}

// Função para obter a data atual no fuso horário de Manaus (UTC-4)
function obterDataManaus() {
  const agora = new Date();
  // Ajusta para o fuso horário de Manaus (UTC-4)
  const offsetManaus = -4 * 60; // Deslocamento em minutos (-4 horas)
  const offsetLocal = agora.getTimezoneOffset(); // Deslocamento do fuso local em minutos
  const diff = offsetManaus - offsetLocal; // Diferença em minutos
  const dataManaus = new Date(agora.getTime() + diff * 60 * 1000); // Ajusta a data
  return dataManaus;
}

// Função para formatar a data no formato YYYY-MM-DD
function formatarDataLocal(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

// Função para formatar a data e hora no formato brasileiro, ajustada para Manaus
function formatarDataHoraManaus(dataStr) {
  const data = new Date(dataStr);
  const offsetManaus = -4 * 60; // Deslocamento em minutos (-4 horas)
  const offsetLocal = data.getTimezoneOffset(); // Deslocamento do fuso local em minutos
  const diff = offsetManaus - offsetLocal; // Diferença em minutos
  const dataManaus = new Date(data.getTime() + diff * 60 * 1000); // Ajusta a data
  return `${dataManaus.toLocaleDateString('pt-BR')} ${dataManaus.toLocaleTimeString('pt-BR')}`;
}

async function carregarMovimentacoes(pagina = 1, porPagina = 10) {
  try {
    document.getElementById('movimentacoes-lista').innerHTML = '<p class="loading">Carregando...</p>';
    const { data: movimentacoes, error } = await db
      .from('movimentacoes_estoque')
      .select('id_produto, quantidade, descricao, created_at')
      .order('created_at', { ascending: false })
      .range((pagina - 1) * porPagina, pagina * porPagina - 1);

    if (error) throw error;

    let html = `
      <table class="table" id="movimentacoes-table">
        <thead>
          <tr>
            <th>ID Produto</th>
            <th>Quantidade Informada</th>
            <th>Descrição</th>
            <th>Data</th>
          </tr>
        </thead>
        <tbody id="movimentacoes-tbody">`;

    if (movimentacoes.length === 0) {
      html += '<tr><td colspan="4" class="error">Nenhuma movimentação encontrada.</td></tr>';
    } else {
      movimentacoes.forEach(item => {
        html += `
          <tr>
            <td data-label="ID Produto">${item.id_produto}</td>
            <td data-label="Quantidade Informada">${item.quantidade}</td>
            <td data-label="Descrição">${item.descricao}</td>
            <td data-label="Data">${formatarDataHoraManaus(item.created_at)}</td>
          </tr>`;
      });
    }

    html += `</tbody></table>`;
    document.getElementById('movimentacoes-lista').innerHTML = html;
  } catch (error) {
    console.error('Erro ao carregar movimentações:', error);
    document.getElementById('movimentacoes-lista').innerHTML = `<p class="error">Erro ao carregar movimentações: ${error.message}</p>`;
  }
}

async function carregarDadosIniciais() {
  try {
    const { data: produtos, error } = await db
      .from('estoque')
      .select('id, produto, categoria, quantidade')
      .order('categoria', { ascending: true })
      .order('produto', { ascending: true });

    if (error) throw error;

    produtosPorCategoria = {};
    produtos.forEach(item => {
      if (!produtosPorCategoria[item.categoria]) {
        produtosPorCategoria[item.categoria] = [];
      }
      if (!produtosPorCategoria[item.categoria].some(p => p.id === item.id)) {
        produtosPorCategoria[item.categoria].push({
          nome: item.produto,
          id: item.id,
          quantidade: item.quantidade
        });
      }
    });

    const selectCategoria = document.getElementById('categoria');
    if (selectCategoria) {
      selectCategoria.innerHTML = '<option value="">Selecione uma categoria</option>';
      Object.keys(produtosPorCategoria).sort().forEach(categoria => {
        const option = document.createElement('option');
        option.value = categoria;
        option.textContent = categoria;
        selectCategoria.appendChild(option);
      });
    }

    console.log("Dados carregados com sucesso");
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    alert('Erro ao carregar dados: ' + error.message);
  }
}

async function carregarProdutosPorCategoria(categoria) {
  try {
    document.getElementById('produtos-lista').innerHTML = '<p class="loading">Carregando produtos...</p>';
    if (!categoria) {
      document.getElementById('produtos-lista').innerHTML = '<p>Selecione uma categoria</p>';
      return;
    }

    const produtos = produtosPorCategoria[categoria] || [];
    const isMobile = window.innerWidth <= 768;

    let html = `
      <table class="table" id="produtos-table">
        <thead>
          <tr>
            ${isMobile ? '' : '<th>ID</th>'}
            <th>Produto</th>
            ${isMobile ? '' : '<th>Quantidade Atual</th>'}
            <th>Nova Quantidade</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody id="produtos-tbody">`;

    if (produtos.length === 0) {
      html += `<tr><td colspan="${isMobile ? '3' : '5'}" class="error">Nenhum produto encontrado para esta categoria.</td></tr>`;
    } else {
      produtos.forEach(produto => {
        html += `
          <tr data-product-id="${produto.id}">
            ${isMobile ? '' : `<td data-label="ID">${produto.id}</td>`}
            <td data-label="Produto" class="product-name">${produto.nome}</td>
            ${isMobile ? '' : `<td data-label="Quantidade Atual" class="quantidade-atual">${produto.quantidade}</td>`}
            <td data-label="Nova Quantidade">
              <input type="number" class="input-estoque" id="quantidade-${produto.id}" min="0"${isMobile ? '' : ' placeholder="Nova quantidade"'}>
            </td>
            <td data-label="Ação">
              <button class="btn btn-action" onclick="atualizarEstoque(${produto.id}, document.getElementById('quantidade-${produto.id}').value, 'Atualização manual')">Atualizar</button>
            </td>
          </tr>`;
      });
    }

    html += `</tbody></table>`;
    document.getElementById('produtos-lista').innerHTML = html;
  } catch (error) {
    console.error('Erro ao carregar produtos:', error);
    document.getElementById('produtos-lista').innerHTML = `<p class="error">Erro ao carregar produtos: ${error.message}</p>`;
  }
}

async function atualizarEstoque(idProduto, novaQuantidade, descricao) {
  try {
    if (!idProduto || isNaN(novaQuantidade) || novaQuantidade < 0) {
      throw new Error('Quantidade inválida ou ID do produto não fornecido');
    }
    if (!descricao.trim()) {
      throw new Error('Descrição é obrigatória');
    }

    novaQuantidade = parseInt(novaQuantidade);

    const { error: updateError } = await db
      .from('estoque')
      .update({ quantidade: novaQuantidade })
      .eq('id', idProduto);

    if (updateError) throw updateError;

    const dataManaus = obterDataManaus();
    const { error: insertError } = await db
      .from('movimentacoes_estoque')
      .insert([
        {
          id_produto: idProduto,
          quantidade: novaQuantidade,
          descricao: descricao,
          created_at: dataManaus.toISOString()
        }
      ]);

    if (insertError) throw insertError;

    const categoriaAtual = document.getElementById('categoria').value;
    const produtoIndex = produtosPorCategoria[categoriaAtual].findIndex(p => p.id === idProduto);
    if (produtoIndex !== -1) {
      produtosPorCategoria[categoriaAtual][produtoIndex].quantidade = novaQuantidade;
    }

    if (window.innerWidth > 768) {
      const quantidadeCell = document.querySelector(`#produtos-tbody tr[data-product-id="${idProduto}"] .quantidade-atual`);
      if (quantidadeCell) {
        quantidadeCell.textContent = novaQuantidade;
      }
    }

    const movimentacoesTbody = document.getElementById('movimentacoes-tbody');
    if (movimentacoesTbody) {
      const newRow = document.createElement('tr');
      newRow.innerHTML = `
        <td data-label="ID Produto">${idProduto}</td>
        <td data-label="Quantidade Informada">${novaQuantidade}</td>
        <td data-label="Descrição">${descricao}</td>
        <td data-label="Data">${formatarDataHoraManaus(dataManaus)}</td>
      `;
      movimentacoesTbody.insertBefore(newRow, movimentacoesTbody.firstChild);
    }

    const currentRow = document.querySelector(`#produtos-tbody tr[data-product-id="${idProduto}"]`);
    const nextRow = currentRow.nextElementSibling;
    if (nextRow) {
      const nextInput = nextRow.querySelector('.input-estoque');
      if (nextInput) {
        nextInput.focus();
        nextInput.select();
      }
    }

    alert('Estoque e movimentação atualizados com sucesso');
  } catch (error) {
    console.error('Erro ao atualizar estoque:', error);
    alert('Erro ao atualizar estoque: ' + error.message);
  }
}

async function carregarComparacao() {
  const dataComparacao = document.getElementById('data-comparacao').value;
  if (!dataComparacao) {
    alert('Selecione uma data para comparação');
    return;
  }

  try {
    document.getElementById('resultado-comparacao').innerHTML = '<p class="loading">Carregando comparação...</p>';

    const dataInicio = `${dataComparacao}T00:00:00`;
    const dataFim = `${dataComparacao}T23:59:59`;

    const { data: movimentacoes, error } = await db
      .from('movimentacoes_estoque')
      .select('id_produto, quantidade, descricao, created_at')
      .gte('created_at', dataInicio)
      .lte('created_at', dataFim);

    if (error) throw error;

    let html = '<h3>Resultados da Comparação</h3>';
    if (movimentacoes.length === 0) {
      html += '<p class="error">Nenhuma movimentação encontrada para a data selecionada.</p>';
    } else {
      html += `
        <table class="table">
          <thead>
            <tr>
              <th>ID Produto</th>
              <th>Quantidade</th>
              <th>Descrição</th>
              <th>Data</th>
            </tr>
          </thead>
          <tbody>`;
      movimentacoes.forEach(item => {
        html += `
          <tr>
            <td data-label="ID Produto">${item.id_produto}</td>
            <td data-label="Quantidade">${item.quantidade}</td>
            <td data-label="Descrição">${item.descricao}</td>
            <td data-label="Data">${formatarDataHoraManaus(item.created_at)}</td>
          </tr>`;
      });
      html += '</tbody></table>';
    }
    document.getElementById('resultado-comparacao').innerHTML = html;
  } catch (error) {
    console.error('Erro ao carregar comparação:', error);
    document.getElementById('resultado-comparacao').innerHTML = `<p class="error">Erro ao carregar comparação: ${error.message}</p>`;
  }
}

async function carregarComparacaoTresDias() {
  const dataFinal = document.getElementById('data-comparacao-tres-dias').value;
  if (!dataFinal) {
    alert('Selecione uma data final para comparação');
    return;
  }

  try {
    document.getElementById('resultado-comparacao-tres-dias').innerHTML = '<p class="loading">Carregando comparação...</p>';

    const dataFinalDate = new Date(dataFinal);
    const dataDia2Date = new Date(dataFinalDate);
    dataDia2Date.setDate(dataFinalDate.getDate() - 1);
    const dataDia3Date = new Date(dataFinalDate);
    dataDia3Date.setDate(dataFinalDate.getDate() - 2);

    const dataDia3 = dataDia3Date.toISOString().split('T')[0];
    const dataDia2 = dataDia2Date.toISOString().split('T')[0];
    const dataDia1 = dataFinal;

    const { data: produtos, error: produtosError } = await db
      .from('estoque')
      .select('id, produto, categoria, quantidade');

    if (produtosError) throw produtosError;

    const { data: movimentacoes, error: movError } = await db
      .from('movimentacoes_estoque')
      .select('id_produto, quantidade, created_at')
      .gte('created_at', `${dataDia3}T00:00:00`)
      .lte('created_at', `${dataDia1}T23:59:59`);

    if (movError) throw movError;

    const estoquePorDia = {};
    produtos.forEach(prod => {
      estoquePorDia[prod.id] = {
        nome: prod.produto,
        categoria: prod.categoria,
        quantidadeDia1: prod.quantidade,
        quantidadeDia2: prod.quantidade,
        quantidadeDia3: prod.quantidade
      };
    });

    movimentacoes.forEach(mov => {
      const movDate = new Date(mov.created_at).toISOString().split('T')[0];
      const prodId = mov.id_produto;
      if (estoquePorDia[prodId]) {
        if (movDate === dataDia3) {
          estoquePorDia[prodId].quantidadeDia3 = mov.quantidade;
        } else if (movDate === dataDia2) {
          estoquePorDia[prodId].quantidadeDia2 = mov.quantidade;
        } else if (movDate === dataDia1) {
          estoquePorDia[prodId].quantidadeDia1 = mov.quantidade;
        }
      }
    });

    let html = `<h3>Comparação de Estoque: ${dataDia3} vs ${dataDia2} vs ${dataDia1}</h3>`;
    html += `<p>Total de produtos analisados: ${Object.keys(estoquePorDia).length}</p>`;
    html += `
      <table class="table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Produto</th>
            <th>Categoria</th>
            <th>Estoque ${dataDia3}</th>
            <th>Estoque ${dataDia2}</th>
            <th>Vendido (Dia 3→2)</th>
            <th>Estoque ${dataDia1}</th>
            <th>Vendido (Dia 2→1)</th>
          </tr>
        </thead>
        <tbody>`;

    const produtosPorCategoria = {};
    Object.values(estoquePorDia).forEach(prod => {
      if (!produtosPorCategoria[prod.categoria]) {
        produtosPorCategoria[prod.categoria] = [];
      }
      produtosPorCategoria[prod.categoria].push(prod);
    });

    let totalVendidoDia3to2 = 0;
    let totalVendidoDia2to1 = 0;

    Object.keys(produtosPorCategoria).sort().forEach(categoria => {
      html += `<tr class="categoria-header"><td colspan="8">${categoria}</td></tr>`;
      produtosPorCategoria[categoria].sort((a, b) => a.nome.localeCompare(b.nome)).forEach(prod => {
        const vendidoDia3to2 = prod.quantidadeDia3 - prod.quantidadeDia2;
        const vendidoDia2to1 = prod.quantidadeDia2 - prod.quantidadeDia1;
        if (vendidoDia3to2 > 0) totalVendidoDia3to2 += vendidoDia3to2;
        if (vendidoDia2to1 > 0) totalVendidoDia2to1 += vendidoDia2to1;
        html += `
          <tr>
            <td data-label="ID">${prod.id}</td>
            <td data-label="Produto">${prod.nome}</td>
            <td data-label="Categoria">${prod.categoria}</td>
            <td data-label="Estoque ${dataDia3}">${prod.quantidadeDia3}</td>
            <td data-label="Estoque ${dataDia2}">${prod.quantidadeDia2}</td>
            <td data-label="Vendido (Dia 3→2)" class="${vendidoDia3to2 > 0 ? 'sales-positive' : ''}">${vendidoDia3to2 >= 0 ? vendidoDia3to2 : 'N/A'}</td>
            <td data-label="Estoque ${dataDia1}">${prod.quantidadeDia1}</td>
            <td data-label="Vendido (Dia 2→1)" class="${vendidoDia2to1 > 0 ? 'sales-positive' : ''}">${vendidoDia2to1 >= 0 ? vendidoDia2to1 : 'N/A'}</td>
          </tr>`;
      });
    });

    if (Object.keys(produtosPorCategoria).length === 0) {
      html += '<tr><td colspan="8" class="error">Nenhum produto encontrado.</td></tr>';
    }

    html += '</tbody></table>';
    html += `<p class="success">Total vendido (Dia 3→2): ${totalVendidoDia3to2} unidades</p>`;
    html += `<p class="success">Total vendido (Dia 2→1): ${totalVendidoDia2to1} unidades</p>`;
    document.getElementById('resultado-comparacao-tres-dias').innerHTML = html;
  } catch (error) {
    console.error('Erro ao carregar comparação de três dias:', error);
    document.getElementById('resultado-comparacao-tres-dias').innerHTML = `<p class="error">Erro ao carregar comparação: ${error.message}</p>`;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const hojeManaus = formatarDataLocal(obterDataManaus());
    document.getElementById('data-registro').value = hojeManaus;
    document.getElementById('data-comparacao').value = hojeManaus;
    document.getElementById('data-comparacao-tres-dias').value = hojeManaus;

    await carregarDadosIniciais();
    await carregarMovimentacoes();

    document.getElementById('categoria').addEventListener('change', async (e) => {
      await carregarProdutosPorCategoria(e.target.value);
    });

    window.addEventListener('resize', async () => {
      const categoria = document.getElementById('categoria').value;
      if (categoria) {
        await carregarProdutosPorCategoria(categoria);
      }
    });
  } catch (error) {
    console.error("Erro na inicialização:", error);
    alert('Erro na inicialização: ' + error.message);
  }
});
