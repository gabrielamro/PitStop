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

  if (secaoId === 'favoritos') {
    carregarFavoritos();
  }
}

function obterDataManaus() {
  const agora = new Date();
  const offsetManaus = -4 * 60;
  const offsetLocal = agora.getTimezoneOffset();
  const diff = offsetManaus - offsetLocal;
  const dataManaus = new Date(agora.getTime() + diff * 60 * 1000);
  return dataManaus;
}

function formatarDataLocal(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function formatarDataHoraManaus(dataStr) {
  const data = new Date(dataStr);
  const offsetManaus = -4 * 60;
  const offsetLocal = data.getTimezoneOffset();
  const diff = offsetManaus - offsetLocal;
  const dataManaus = new Date(data.getTime() + diff * 60 * 1000);
  return `${dataManaus.toLocaleDateString('pt-BR')} ${dataManaus.toLocaleTimeString('pt-BR')}`;
}

async function carregarDadosIniciais() {
  try {
    const { data: produtos, error } = await db
      .from('estoque')
      .select('id, produto, categoria, quantidade, favorito')
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
          quantidade: item.quantidade,
          favorito: item.favorito || false,
          categoriaOriginal: item.categoria
        });
      }
    });

    Object.keys(produtosPorCategoria).forEach(categoria => {
      produtosPorCategoria[categoria].sort((a, b) => {
        if (a.favorito && !b.favorito) return -1;
        if (!a.favorito && b.favorito) return 1;
        return a.nome.localeCompare(b.nome);
      });
    });

    const selectCategoria = document.getElementById('categoria');
    if (selectCategoria) {
      selectCategoria.innerHTML = '<option value="">Selecione uma categoria</option>';
      const optionFavoritos = document.createElement('option');
      optionFavoritos.value = 'Favoritos';
      optionFavoritos.textContent = 'Favoritos';
      selectCategoria.appendChild(optionFavoritos);

      Object.keys(produtosPorCategoria).sort().forEach(categoria => {
        const option = document.createElement('option');
        option.value = categoria;
        option.textContent = categoria;
        selectCategoria.appendChild(option);
      });
    }
  } catch (error) {
    console.error('Erro ao carregar dados:', error);
    alert('Erro ao carregar dados: ' + error.message);
  }
}

async function toggleFavorito(idProduto, isFavorito) {
  try {
    const novoEstado = !isFavorito;
    const { error } = await db
      .from('estoque')
      .update({ favorito: novoEstado })
      .eq('id', idProduto);

    if (error) throw new Error(`Falha ao atualizar favorito no banco de dados: ${error.message}`);

    let categoriaProduto = null;
    Object.keys(produtosPorCategoria).forEach(categoria => {
      const produtoIndex = produtosPorCategoria[categoria].findIndex(p => p.id === idProduto);
      if (produtoIndex !== -1) {
        produtosPorCategoria[categoria][produtoIndex].favorito = novoEstado;
        categoriaProduto = categoria;
        produtosPorCategoria[categoria].sort((a, b) => {
          if (a.favorito && !b.favorito) return -1;
          if (!a.favorito && b.favorito) return 1;
          return a.nome.localeCompare(b.nome);
        });
      }
    });

    if (!categoriaProduto) {
      console.warn(`Produto com ID ${idProduto} não encontrado em produtosPorCategoria.`);
    }

    const estrela = document.querySelector(`#favorito-${idProduto}`);
    if (estrela) {
      estrela.classList.toggle('fas', novoEstado);
      estrela.classList.toggle('far', !novoEstado);
    } else {
      console.warn(`Elemento com ID favorito-${idProduto} não encontrado no DOM.`);
    }

    const categoriaAtual = document.getElementById('categoria')?.value;
    if (categoriaAtual === 'Favoritos') {
      await carregarProdutosPorCategoria('Favoritos');
    } else if (categoriaAtual && categoriaAtual !== '' && categoriaProduto === categoriaAtual) {
      await carregarProdutosPorCategoria(categoriaAtual);
    }

    if (document.getElementById('favoritos')?.classList.contains('active')) {
      await carregarFavoritos();
    }
  } catch (error) {
    console.error('Erro ao atualizar favorito:', error.message, error.stack);
    alert(`Erro ao atualizar favorito: ${error.message}`);
  }
}

async function carregarFavoritos() {
  try {
    document.getElementById('favoritos-lista').innerHTML = '<p class="loading">Carregando favoritos...</p>';

    const favoritos = [];
    Object.keys(produtosPorCategoria).forEach(categoria => {
      produtosPorCategoria[categoria].forEach(produto => {
        if (produto.favorito) {
          favoritos.push({ ...produto, categoria });
        }
      });
    });

    const isMobile = window.innerWidth <= 768;
    let html = `
      <table class="table" id="favoritos-table">
        <thead>
          <tr>
            ${isMobile ? '' : '<th>ID</th>'}
            <th>Produto</th>
            ${isMobile ? '' : '<th>Categoria</th>'}
            ${isMobile ? '' : '<th>Total</th>'}
            <th>Favorito</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody id="favoritos-tbody">`;

    if (favoritos.length === 0) {
      html += `<tr><td colspan="${isMobile ? 3 : 5}" class="error">Nenhum produto favoritado.</td></tr>`;
    } else {
      favoritos.forEach(produto => {
        html += `
          <tr data-product-id="${produto.id}">
            ${isMobile ? '' : `<td data-label="ID">${produto.id}</td>`}
            <td data-label="Produto" class="product-name">${produto.nome}</td>
            ${isMobile ? '' : `<td data-label="Categoria">${produto.categoria}</td>`}
            ${isMobile ? '' : `<td data-label="Total" class="quantidade-atual">${produto.quantidade}</td>`}
            <td data-label="Favorito">
              <i id="favorito-${produto.id}" class="${produto.favorito ? 'fas' : 'far'} fa-star favorito-star" onclick="toggleFavorito(${produto.id}, ${produto.favorito})"></i>
            </td>
            <td data-label="Ação">
              <button type="button" class="btn btn-action btn-atualizar" data-id="${produto.id}" data-mostrar-grades="false">Atualizar</button>
              <button type="button" class="btn btn-action btn-adicionar" data-id="${produto.id}" data-mostrar-grades="false">ADD</button>
            </td>
          </tr>`;
      });
    }

    html += `</tbody></table>`;
    document.getElementById('favoritos-lista').innerHTML = html;

    document.querySelectorAll('#favoritos-tbody .btn-atualizar').forEach(button => {
      button.addEventListener('click', () => {
        const idProduto = button.getAttribute('data-id');
        const unidadesValue = prompt('Digite a quantidade de unidades:');
        if (unidadesValue !== null) {
          atualizarEstoque(idProduto, 0, parseInt(unidadesValue), 'Atualização manual (Favoritos)');
        }
      });
    });

    document.querySelectorAll('#favoritos-tbody .btn-adicionar').forEach(button => {
      button.addEventListener('click', () => {
        const idProduto = button.getAttribute('data-id');
        const unidadesValue = prompt('Digite a quantidade de unidades a adicionar:');
        if (unidadesValue !== null) {
          adicionarEstoque(idProduto, 0, parseInt(unidadesValue), 'Adição ao estoque (Favoritos)');
        }
      });
    });
  } catch (error) {
    console.error('Erro ao carregar favoritos:', error);
    document.getElementById('favoritos-lista').innerHTML = `<p class="error">Erro ao carregar favoritos: ${error.message}</p>`;
  }
}

async function carregarProdutosPorCategoria(categoria) {
  try {
    document.getElementById('produtos-lista').innerHTML = '<p class="loading">Carregando produtos...</p>';
    if (!categoria) {
      document.getElementById('produtos-lista').innerHTML = '<p>Selecione uma categoria</p>';
      return;
    }

    let produtos = [];
    if (categoria === 'Favoritos') {
      Object.keys(produtosPorCategoria).forEach(cat => {
        produtosPorCategoria[cat].forEach(produto => {
          if (produto.favorito) {
            produtos.push({ ...produto, categoria: produto.categoriaOriginal });
          }
        });
      });
      produtos.sort((a, b) => a.nome.localeCompare(b.nome));
    } else {
      produtos = produtosPorCategoria[categoria] || [];
    }

    const isMobile = window.innerWidth <= 768;
    const mostrarGrades = categoria === "1 - Cervejas LITRÃO";

    let html = `
      <table class="table" id="produtos-table">
        <thead>
          <tr>
            ${isMobile ? '' : '<th>ID</th>'}
            <th>Produto</th>
            ${isMobile ? '' : `<th>Total</th>`}
            ${mostrarGrades && !isMobile ? '<th>Grades</th>' : ''}
            ${mostrarGrades && !isMobile ? '<th>Unidades Restantes</th>' : ''}
            ${mostrarGrades ? '<th>Grades</th>' : ''}
            <th>Unidades</th>
            <th>Favorito</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody id="produtos-tbody">`;

    if (produtos.length === 0) {
      const colspanDesktop = mostrarGrades ? (isMobile ? 5 : 8) : (isMobile ? 4 : 6);
      html += `<tr><td colspan="${colspanDesktop}" class="error">Nenhum produto encontrado para esta categoria.</td></tr>`;
    } else {
      produtos.forEach(produto => {
        const totalUnidades = produto.quantidade || 0;
        const gradesCalculadas = mostrarGrades ? Math.floor(totalUnidades / 12) : 0;
        const unidadesRestantes = mostrarGrades ? totalUnidades % 12 : totalUnidades;

        html += `
          <tr data-product-id="${produto.id}">
            ${isMobile ? '' : `<td data-label="ID">${produto.id}</td>`}
            <td data-label="Produto" class="product-name">${produto.nome}</td>
            ${isMobile ? '' : `<td data-label="Total" class="quantidade-atual">${totalUnidades}</td>`}
            ${mostrarGrades && !isMobile ? `<td data-label="Grades">${gradesCalculadas}</td>` : ''}
            ${mostrarGrades && !isMobile ? `<td data-label="Unidades Restantes">${unidadesRestantes}</td>` : ''}
            ${mostrarGrades ? `
              <td data-label="Grades">
                <input type="tel" inputmode="numeric" pattern="[0-9]*" class="input-estoque" id="grades-${produto.id}" min="0"${isMobile ? '' : ' placeholder="Nº de grades"'} onkeydown="if(event.key === 'Enter') event.preventDefault();">
              </td>
            ` : ''}
            <td data-label="Unidades">
              <input type="tel" inputmode="numeric" pattern="[0-9]*" class="input-estoque" id="unidades-${produto.id}" min="0"${isMobile ? '' : ' placeholder="Unidades avulsas"'} onkeydown="if(event.key === 'Enter') event.preventDefault();">
            </td>
            <td data-label="Favorito">
              <i id="favorito-${produto.id}" class="${produto.favorito ? 'fas' : 'far'} fa-star favorito-star" onclick="toggleFavorito(${produto.id}, ${produto.favorito})"></i>
            </td>
            <td data-label="Ação">
              <button type="button" class="btn btn-action btn-atualizar" data-id="${produto.id}" data-mostrar-grades="${mostrarGrades}">Atualizar</button>
              <button type="button" class="btn btn-action btn-adicionar" data-id="${produto.id}" data-mostrar-grades="${mostrarGrades}">ADD</button>
            </td>
          </tr>`;
      });
    }

    html += `</tbody></table>`;
    document.getElementById('produtos-lista').innerHTML = html;

    document.querySelectorAll('#produtos-tbody .btn-atualizar').forEach(button => {
      button.addEventListener('click', () => {
        const idProduto = button.getAttribute('data-id');
        const mostrarGrades = button.getAttribute('data-mostrar-grades') === 'true';
        const gradesValue = mostrarGrades ? document.getElementById(`grades-${idProduto}`).value : '0';
        const unidadesValue = document.getElementById(`unidades-${idProduto}`).value;
        atualizarEstoque(idProduto, gradesValue, unidadesValue, 'Atualização manual');
      });
    });

    document.querySelectorAll('#produtos-tbody .btn-adicionar').forEach(button => {
      button.addEventListener('click', () => {
        const idProduto = button.getAttribute('data-id');
        const mostrarGrades = button.getAttribute('data-mostrar-grades') === 'true';
        const gradesValue = mostrarGrades ? document.getElementById(`grades-${idProduto}`).value : '0';
        const unidadesValue = document.getElementById(`unidades-${idProduto}`).value;
        adicionarEstoque(idProduto, gradesValue, unidadesValue, 'Adição ao estoque');
      });
    });

    document.querySelectorAll('.input-estoque').forEach(input => {
      const forceFocus = () => {
        setTimeout(() => {
          input.focus();
          input.select();
        }, 100);
      };

      input.addEventListener('touchend', (e) => {
        forceFocus();
      });

      input.addEventListener('click', () => {
        forceFocus();
      });
    });
  } catch (error) {
    console.error('Erro ao carregar produtos:', error);
    document.getElementById('produtos-lista').innerHTML = `<p class="error">Erro ao carregar produtos: ${error.message}</p>`;
  }
}

async function atualizarEstoque(idProduto, grades, unidades, descricao) {
  try {
    grades = parseInt(grades) || 0;
    unidades = parseInt(unidades) || 0;

    if (grades === 0 && unidades === 0) {
      alert('Por favor, informe pelo menos uma quantidade (grades ou unidades).');
      return;
    }

    if (!idProduto || unidades < 0) {
      throw new Error('Quantidade de unidades inválida, ou ID do produto não fornecido');
    }
    if (grades < 0) {
      throw new Error('Quantidade de grades inválida');
    }
    if (!descricao.trim()) {
      throw new Error('Descrição é obrigatória');
    }

    const novaQuantidade = (grades * 12) + unidades;

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
          tipo_movimentacao: 'entrada',
          descricao: descricao,
          created_at: dataManaus.toISOString()
        }
      ]);

    if (insertError) throw insertError;

    const categoriaAtual = document.getElementById('categoria')?.value;
    let categoriaProduto = null;
    Object.keys(produtosPorCategoria).forEach(categoria => {
      const produtoIndex = produtosPorCategoria[categoria].findIndex(p => p.id === idProduto);
      if (produtoIndex !== -1) {
        produtosPorCategoria[categoria][produtoIndex].quantidade = novaQuantidade;
        categoriaProduto = categoria;
      }
    });

    if (window.innerWidth > 768) {
      const quantidadeCell = document.querySelector(`#produtos-tbody tr[data-product-id="${idProduto}"] .quantidade-atual`);
      if (quantidadeCell) {
        quantidadeCell.textContent = novaQuantidade;
      }
    }

    const gradesInput = document.getElementById(`grades-${idProduto}`);
    const unidadesInput = document.getElementById(`unidades-${idProduto}`);
    if (gradesInput) gradesInput.value = '';
    if (unidadesInput) unidadesInput.value = '';

    const mostrarGrades = categoriaAtual === "1 - Cervejas LITRÃO";
    const mensagemGrades = mostrarGrades && grades > 0 ? `${grades} grades + ` : '';
    alert(`Estoque e movimentação atualizados com sucesso. Total: ${novaQuantidade} unidades (${mensagemGrades}${unidades} unidades)`);

    if (categoriaAtual && categoriaAtual !== '' && categoriaAtual !== 'Favoritos' && categoriaProduto === categoriaAtual) {
      await carregarProdutosPorCategoria(categoriaAtual);
    } else if (categoriaAtual === 'Favoritos') {
      await carregarProdutosPorCategoria('Favoritos');
    }
  } catch (error) {
    console.error('Erro ao atualizar estoque:', error);
    alert('Erro ao atualizar estoque: ' + error.message);
  }
}

async function adicionarEstoque(idProduto, grades, unidades, descricao) {
  try {
    grades = parseInt(grades) || 0;
    unidades = parseInt(unidades) || 0;

    if (grades === 0 && unidades === 0) {
      alert('Por favor, informe pelo menos uma quantidade (grades ou unidades).');
      return;
    }

    if (!idProduto || unidades < 0) {
      throw new Error('Quantidade de unidades inválida, ou ID do produto não fornecido');
    }
    if (grades < 0) {
      throw new Error('Quantidade de grades inválida');
    }
    if (!descricao.trim()) {
      throw new Error('Descrição é obrigatória');
    }

    const { data: produto, error: fetchError } = await db
      .from('estoque')
      .select('quantidade')
      .eq('id', idProduto)
      .single();

    if (fetchError || !produto) {
      throw new Error('Produto não encontrado no banco de dados');
    }

    const quantidadeAtual = produto.quantidade || 0;
    const quantidadeAdicional = (grades * 12) + unidades;
    const novaQuantidade = quantidadeAtual + quantidadeAdicional;

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
          quantidade: quantidadeAdicional,
          tipo_movimentacao: 'entrada',
          descricao: descricao,
          created_at: dataManaus.toISOString()
        }
      ]);

    if (insertError) throw insertError;

    const categoriaAtual = document.getElementById('categoria')?.value;
    let categoriaProduto = null;
    Object.keys(produtosPorCategoria).forEach(categoria => {
      const produtoIndex = produtosPorCategoria[categoria].findIndex(p => p.id === idProduto);
      if (produtoIndex !== -1) {
        produtosPorCategoria[categoria][produtoIndex].quantidade = novaQuantidade;
        categoriaProduto = categoria;
      }
    });

    if (window.innerWidth > 768) {
      const quantidadeCell = document.querySelector(`#produtos-tbody tr[data-product-id="${idProduto}"] .quantidade-atual`);
      if (quantidadeCell) {
        quantidadeCell.textContent = novaQuantidade;
      }
    }

    const gradesInput = document.getElementById(`grades-${idProduto}`);
    const unidadesInput = document.getElementById(`unidades-${idProduto}`);
    if (gradesInput) gradesInput.value = '';
    if (unidadesInput) unidadesInput.value = '';

    const mostrarGrades = categoriaAtual === "1 - Cervejas LITRÃO";
    const mensagemGrades = mostrarGrades && grades > 0 ? `${grades} grades + ` : '';
    alert(`Estoque atualizado com sucesso. Estoque atual: ${quantidadeAtual} unidades. Total adicionado: ${quantidadeAdicional} unidades (${mensagemGrades}${unidades} unidades). Novo total: ${novaQuantidade} unidades`);

    if (categoriaAtual && categoriaAtual !== '' && categoriaAtual !== 'Favoritos' && categoriaProduto === categoriaAtual) {
      await carregarProdutosPorCategoria(categoriaAtual);
    } else if (categoriaAtual === 'Favoritos') {
      await carregarProdutosPorCategoria('Favoritos');
    }
  } catch (error) {
    console.error('Erro ao adicionar estoque:', error);
    alert('Erro ao adicionar estoque: ' + error.message);
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
      .select('id_produto, quantidade, tipo_movimentacao, descricao, created_at')
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
              <th>Tipo Movimentação</th>
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
            <td data-label="Tipo Movimentação">${item.tipo_movimentacao}</td>
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
            <th>Total D1</th>
            <th>Estoque ${dataDia1}</th>
            <th>Total D2</th>
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

    let totalD1 = 0;
    let totalD2 = 0;

    Object.keys(produtosPorCategoria).sort().forEach(categoria => {
      html += `<tr class="categoria-header"><td colspan="8">${categoria}</td></tr>`;
      produtosPorCategoria[categoria].sort((a, b) => a.nome.localeCompare(b.nome)).forEach(prod => {
        const diffDia3to2 = prod.quantidadeDia3 - prod.quantidadeDia2;
        const diffDia2to1 = prod.quantidadeDia2 - prod.quantidadeDia1;
        if (diffDia3to2 > 0) totalD1 += diffDia3to2;
        if (diffDia2to1 > 0) totalD2 += diffDia2to1;
        html += `
          <tr>
            <td data-label="ID">${prod.id}</td>
            <td data-label="Produto">${prod.nome}</td>
            <td data-label="Categoria">${prod.categoria}</td>
            <td data-label="Estoque ${dataDia3}">${prod.quantidadeDia3}</td>
            <td data-label="Estoque ${dataDia2}">${prod.quantidadeDia2}</td>
            <td data-label="Total D1" class="${diffDia3to2 > 0 ? 'sales-positive' : ''}">${diffDia3to2 >= 0 ? diffDia3to2 : 'N/A'}</td>
            <td data-label="Estoque ${dataDia1}">${prod.quantidadeDia1}</td>
            <td data-label="Total D2" class="${diffDia2to1 > 0 ? 'sales-positive' : ''}">${diffDia2to1 >= 0 ? diffDia2to1 : 'N/A'}</td>
          </tr>`;
      });
    });

    if (Object.keys(produtosPorCategoria).length === 0) {
      html += '<tr><td colspan="8" class="error">Nenhum produto encontrado.</td></tr>';
    }

    html += '</tbody></table>';
    html += `<p class="success">Total D1: ${totalD1} unidades</p>`;
    html += `<p class="success">Total D2: ${totalD2} unidades</p>`;
    document.getElementById('resultado-comparacao-tres-dias').innerHTML = html;
  } catch (error) {
    console.error('Erro ao carregar comparação de três dias:', error);
    document.getElementById('resultado-comparacao-tres-dias').innerHTML = `<p class="error">Erro ao carregar comparação: ${error.message}</p>`;
  }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const hojeManaus = formatarDataLocal(obterDataManaus());
    const dataRegistro = document.getElementById('data-registro');
    const dataComparacao = document.getElementById('data-comparacao');
    const dataComparacaoTresDias = document.getElementById('data-comparacao-tres-dias');

    if (dataRegistro) {
      dataRegistro.value = hojeManaus;
    }

    if (dataComparacao) {
      dataComparacao.value = hojeManaus;
    }

    if (dataComparacaoTresDias) {
      dataComparacaoTresDias.value = hojeManaus;
    }

    await carregarDadosIniciais();

    document.getElementById('categoria').addEventListener('change', async (e) => {
      await carregarProdutosPorCategoria(e.target.value);
    });

    const debouncedCarregarProdutos = debounce(async () => {
      const categoria = document.getElementById('categoria').value;
      if (categoria) {
        await carregarProdutosPorCategoria(categoria);
      }
    }, 300);

    window.addEventListener('resize', debouncedCarregarProdutos);
  } catch (error) {
    console.error("Erro na inicialização:", error);
    alert('Erro na inicialização: ' + error.message);
  }
});
