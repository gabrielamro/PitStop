// Configuração do Supabase (use RLS no Supabase e mova para backend em produção)
const SUPABASE_URL = "https://mzahiyhvxxgegyyfmmbl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16YWhpeWh2eHhnZWd5eWZtbWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ0MzUzMzIsImV4cCI6MjA2MDAxMTMzMn0.IBwErJNVkeNUggCxXzZ0MsDldTRqAlqTAcWoxkX5gsU";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: true, persistSession: true }
});

let produtosPorCategoria = {};

// Exibir mensagens no DOM
function mostrarMensagem(mensagem, tipo = 'error') {
  const mensagensDiv = document.getElementById('mensagens');
  const mensagemDiv = document.createElement('div');
  mensagemDiv.className = `message ${tipo}`;
  mensagemDiv.innerHTML = `<i class="fas fa-${tipo === 'error' ? 'exclamation-circle' : 'check-circle'}"></i> ${mensagem}`;
  mensagensDiv.appendChild(mensagemDiv);
  setTimeout(() => mensagemDiv.remove(), 5000);
}

// Alternar sidebar
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('active');
  document.getElementById('sidebarOverlay').classList.toggle('active');
}

// Mostrar seção ativa
function mostrarSecao(secaoId) {
  document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
  document.getElementById(secaoId).classList.add('active');
  document.querySelectorAll('.sidebar li').forEach(li => li.classList.remove('active'));
  document.querySelector(`.sidebar li[onclick="mostrarSecao('${secaoId}')"]`).classList.add('active');
  if (window.innerWidth <= 768) toggleSidebar();
}

// Alternar campo de nova categoria
function toggleNovaCategoria() {
  const novaCategoriaDiv = document.getElementById('nova-categoria');
  const categoriaSelect = document.getElementById('categoria');
  const toggleButton = document.querySelector('button[onclick="toggleNovaCategoria()"]');
  
  if (novaCategoriaDiv.style.display === 'none') {
    novaCategoriaDiv.style.display = 'block';
    categoriaSelect.disabled = true;
    toggleButton.innerHTML = '<i class="fas fa-list"></i> Selecionar Categoria';
  } else {
    novaCategoriaDiv.style.display = 'none';
    categoriaSelect.disabled = false;
    toggleButton.innerHTML = '<i class="fas fa-plus"></i> Nova Categoria';
    document.getElementById('nova-categoria-input').value = '';
  }
}

// Obter data em Manaus
function obterDataManaus() {
  const agora = new Date();
  const offsetManaus = -4 * 60;
  const offsetLocal = agora.getTimezoneOffset();
  const diff = offsetManaus - offsetLocal;
  return new Date(agora.getTime() + diff * 60 * 1000);
}

// Formatador de data local
function formatarDataLocal(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

// Formatador de data e hora em Manaus
function formatarDataHoraManaus(dataStr) {
  const data = new Date(dataStr);
  const offsetManaus = -4 * 60;
  const offsetLocal = data.getTimezoneOffset();
  const diff = offsetManaus - offsetLocal;
  const dataManaus = new Date(data.getTime() + diff * 60 * 1000);
  return `${dataManaus.toLocaleDateString('pt-BR')} ${dataManaus.toLocaleTimeString('pt-BR')}`;
}

// Carregar dados iniciais
async function carregarDadosIniciais() {
  try {
    const { data: produtos, error } = await db
      .from('estoque')
      .select('id,produto,categoria,quantidade,favorito')
      .order('categoria', { ascending: true })
      .order('produto', { ascending: true });

    if (error) {
      console.log('Erro completo:', error);
      throw new Error(`Erro ao carregar produtos: ${error.message}`);
    }

    produtosPorCategoria = {};
    produtos.forEach(item => {
      if (!produtosPorCategoria[item.categoria]) produtosPorCategoria[item.categoria] = [];
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
    mostrarMensagem('Falha ao carregar os dados. Verifique sua conexão ou permissões.');
  }
}

// Alternar favorito
async function toggleFavorito(idProduto, isFavorito) {
  try {
    const novoEstado = !isFavorito;
    const { error } = await db
      .from('estoque')
      .update({ favorito: novoEstado })
      .eq('id', idProduto);

    if (error) throw new Error(`Erro ao atualizar favorito: ${error.message}`);

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

    const estrela = document.querySelector(`#favorito-${idProduto}`);
    if (estrela) {
      estrela.classList.toggle('fas', novoEstado);
      estrela.classList.toggle('far', !novoEstado);
    }

    const categoriaAtual = document.getElementById('categoria')?.value;
    if (categoriaAtual === 'Favoritos' || (categoriaAtual && categoriaAtual !== '' && categoriaProduto === categoriaAtual)) {
      await carregarProdutosPorCategoria(categoriaAtual);
    }
  } catch (error) {
    console.error('Erro ao atualizar favorito:', error);
    mostrarMensagem('Falha ao atualizar favorito. Tente novamente.');
  }
}

// Carregar produtos por categoria
async function carregarProdutosPorCategoria(categoria) {
  try {
    const produtosLista = document.getElementById('produtos-lista');
    produtosLista.innerHTML = '<p class="loading">Carregando produtos...</p>';
    if (!categoria) {
      produtosLista.innerHTML = '<p>Selecione uma categoria</p>';
      return;
    }

    let produtos = [];
    if (categoria === 'Favoritos') {
      Object.keys(produtosPorCategoria).forEach(cat => {
        produtosPorCategoria[cat].forEach(produto => {
          if (produto.favorito) produtos.push({ ...produto, categoria: produto.categoriaOriginal });
        });
      });
      produtos.sort((a, b) => a.nome.localeCompare(b.nome));
    } else {
      produtos = produtosPorCategoria[categoria] || [];
    }

    const isMobile = window.innerWidth <= 768;
    const mostrarGrades = categoria === "1 - Cervejas LITRÃO";

    let html = `
      <div class="table-controls" style="margin-bottom: 10px;">
        <button type="button" id="excluir-selecionados" class="btn btn-action" style="background: var(--danger); display: none;">Excluir Selecionados</button>
      </div>
      <table class="table" id="produtos-table">
        <thead>
          <tr>
            <th><input type="checkbox" id="selecionar-todos"></th>
            ${isMobile ? '' : '<th>ID</th>'}
            <th>Produto</th>
            ${isMobile ? '' : `<th>Total</th>`}
            ${mostrarGrades && !isMobile ? '<th>Grades</th><th>Unidades Restantes</th>' : ''}
            ${mostrarGrades ? '<th>Grades</th>' : ''}
            <th>Unidades</th>
            <th>Favorito</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody id="produtos-tbody">`;

    if (produtos.length === 0) {
      const colspan = mostrarGrades ? (isMobile ? 5 : 8) : (isMobile ? 4 : 6);
      html += `<tr><td colspan="${colspan}" class="error">Nenhum produto encontrado.</td></tr>`;
    } else {
      produtos.forEach(produto => {
        const totalUnidades = produto.quantidade || 0;
        const gradesCalculadas = mostrarGrades ? Math.floor(totalUnidades / 12) : 0;
        const unidadesRestantes = mostrarGrades ? totalUnidades % 12 : totalUnidades;

        html += `
          <tr data-product-id="${produto.id}">
            <td><input type="checkbox" class="selecionar-produto" data-id="${produto.id}"></td>
            ${isMobile ? '' : `<td data-label="ID">${produto.id}</td>`}
            <td data-label="Produto" class="product-name">${produto.nome}</td>
            ${isMobile ? '' : `<td data-label="Total" class="quantidade-atual">${totalUnidades}</td>`}
            ${mostrarGrades && !isMobile ? `<td data-label="Grades">${gradesCalculadas}</td><td data-label="Unidades Restantes">${unidadesRestantes}</td>` : ''}
            ${mostrarGrades ? `<td data-label="Grades"><input type="number" class="input-estoque" id="grades-${produto.id}" min="0" placeholder="Nº de grades"></td>` : ''}
            <td data-label="Unidades"><input type="number" class="input-estoque" id="unidades-${produto.id}" min="0" placeholder="Unidades"></td>
            <td data-label="Favorito"><i id="favorito-${produto.id}" class="${produto.favorito ? 'fas' : 'far'} fa-star favorito-star" onclick="toggleFavorito(${produto.id}, ${produto.favorito})"></i></td>
            <td data-label="Ação">
              <button type="button" class="btn btn-action btn-atualizar" data-id="${produto.id}" data-mostrar-grades="${mostrarGrades}">Atualizar</button>
              <button type="button" class="btn btn-action btn-adicionar" data-id="${produto.id}" data-mostrar-grades="${mostrarGrades}">ADD</button>
            </td>
          </tr>`;
      });
    }

    html += `</tbody></table>`;
    produtosLista.innerHTML = html;

    // Configurar eventos
    document.querySelectorAll('#produtos-tbody .btn-atualizar').forEach(button => {
      button.addEventListener('click', () => {
        const idProduto = button.getAttribute('data-id');
        const mostrarGrades = button.getAttribute('data-mostrar-grades') === 'true';
        const gradesValue = mostrarGrades ? document.getElementById(`grades-${idProduto}`)?.value : '0';
        const unidadesValue = document.getElementById(`unidades-${idProduto}`)?.value;
        if (validarInputs(gradesValue, unidadesValue)) {
          atualizarEstoque(idProduto, gradesValue, unidadesValue, 'Atualização manual');
        }
      });
    });

    document.querySelectorAll('#produtos-tbody .btn-adicionar').forEach(button => {
      button.addEventListener('click', () => {
        const idProduto = button.getAttribute('data-id');
        const mostrarGrades = button.getAttribute('data-mostrar-grades') === 'true';
        const gradesValue = mostrarGrades ? document.getElementById(`grades-${idProduto}`)?.value : '0';
        const unidadesValue = document.getElementById(`unidades-${idProduto}`)?.value;
        if (validarInputs(gradesValue, unidadesValue)) {
          adicionarEstoque(idProduto, gradesValue, unidadesValue, 'Adição ao estoque');
        }
      });
    });

    configurarSelecaoProdutos();
  } catch (error) {
    console.error('Erro ao carregar produtos:', error);
    document.getElementById('produtos-lista').innerHTML = `<p class="error">Erro ao carregar produtos: ${error.message}</p>`;
  }
}

// Validar inputs
function validarInputs(grades, unidades) {
  const gradesNum = parseInt(grades) || 0;
  const unidadesNum = parseInt(unidades) || 0;
  if (isNaN(gradesNum) || isNaN(unidadesNum) || gradesNum < 0 || unidadesNum < 0) {
    mostrarMensagem('Por favor, insira valores numéricos válidos.');
    return false;
  }
  if (gradesNum === 0 && unidadesNum === 0) {
    mostrarMensagem('Informe pelo menos uma quantidade (grades ou unidades).');
    return false;
  }
  return true;
}

// Configurar seleção de produtos
function configurarSelecaoProdutos() {
  const selecionarTodos = document.getElementById('selecionar-todos');
  const checkboxes = document.querySelectorAll('.selecionar-produto');
  const botaoExcluir = document.getElementById('excluir-selecionados');

  selecionarTodos.addEventListener('change', () => {
    checkboxes.forEach(checkbox => (checkbox.checked = selecionarTodos.checked));
    botaoExcluir.style.display = Array.from(checkboxes).some(c => c.checked) ? 'inline-block' : 'none';
  });

  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      selecionarTodos.checked = Array.from(checkboxes).every(c => c.checked);
      botaoExcluir.style.display = Array.from(checkboxes).some(c => c.checked) ? 'inline-block' : 'none';
    });
  });

  botaoExcluir.addEventListener('click', () => {
    const selecionados = Array.from(checkboxes)
      .filter(checkbox => checkbox.checked)
      .map(checkbox => checkbox.getAttribute('data-id'));
    if (selecionados.length === 0) {
      mostrarMensagem('Nenhum produto selecionado para exclusão.');
      return;
    }
    if (confirm(`Tem certeza que deseja excluir ${selecionados.length} produto(s)?`)) {
      excluirProdutos(selecionados);
    }
  });
}

// Adicionar novo produto
async function adicionarNovoProduto(form) {
  try {
    const button = form.querySelector('#adicionar-btn');
    button.disabled = true;

    const nomeProduto = document.getElementById('novo-produto').value.trim();
    const categoriaSelect = document.getElementById('categoria').value;
    const novaCategoriaInput = document.getElementById('nova-categoria-input').value.trim();
    const isNovaCategoria = document.getElementById('nova-categoria').style.display !== 'none';

    if (!nomeProduto) {
      mostrarMensagem('Por favor, insira o nome do produto.');
      return;
    }

    let categoria = isNovaCategoria ? novaCategoriaInput : categoriaSelect;
    if (!categoria || categoria === 'Favoritos' || categoria === '') {
      mostrarMensagem('Por favor, selecione uma categoria existente ou insira uma nova categoria válida.');
      return;
    }

    const nomeProdutoSanitizado = nomeProduto.replace(/[^\w\s-]/g, '').substring(0, 255);
    const categoriaSanitizada = categoria.replace(/[^\w\s-]/g, '').substring(0, 255);

    if (!nomeProdutoSanitizado || !categoriaSanitizada) {
      mostrarMensagem('Nome do produto ou categoria contém caracteres inválidos.');
      return;
    }

    const { data: produtoExistente, error: fetchError } = await db
      .from('estoque')
      .select('id')
      .eq('produto', encodeURIComponent(nomeProdutoSanitizado))
      .eq('categoria', encodeURIComponent(categoriaSanitizada))
      .maybeSingle();

    if (produtoExistente) {
      mostrarMensagem('Este produto já existe nesta categoria.');
      return;
    }
    if (fetchError && fetchError.code !== 'PGRST116') {
      console.log('Erro ao verificar produto:', fetchError);
      throw new Error(`Erro ao verificar produto: ${fetchError.message}`);
    }

    const { data, error } = await db
      .from('estoque')
      .insert([{ produto: nomeProdutoSanitizado, categoria: categoriaSanitizada, quantidade: 0, favorito: false }])
      .select('id,produto,categoria,quantidade,favorito')
      .single();

    if (error) {
      if (error.message.includes('duplicate key')) {
        mostrarMensagem('Erro: Este produto já existe ou houve um conflito no banco de dados.');
        return;
      }
      throw new Error(`Erro ao inserir produto: ${error.message}`);
    }

    if (!produtosPorCategoria[categoriaSanitizada]) produtosPorCategoria[categoriaSanitizada] = [];
    produtosPorCategoria[categoriaSanitizada].push({
      nome: data.produto,
      id: data.id,
      quantidade: data.quantidade,
      favorito: data.favorito,
      categoriaOriginal: data.categoria
    });

    produtosPorCategoria[categoriaSanitizada].sort((a, b) => {
      if (a.favorito && !b.favorito) return -1;
      if (!a.favorito && b.favorito) return 1;
      return a.nome.localeCompare(b.nome);
    });

    const selectCategoria = document.getElementById('categoria');
    if (!selectCategoria.querySelector(`option[value="${categoriaSanitizada}"]`)) {
      const option = document.createElement('option');
      option.value = categoriaSanitizada;
      option.textContent = categoriaSanitizada;
      selectCategoria.appendChild(option);
    }

    document.getElementById('novo-produto').value = '';
    document.getElementById('nova-categoria-input').value = '';
    document.getElementById('nova-categoria').style.display = 'none';
    selectCategoria.disabled = false;
    document.querySelector('button[onclick="toggleNovaCategoria()"]').innerHTML = '<i class="fas fa-plus"></i> Nova Categoria';
    selectCategoria.value = categoriaSanitizada;

    await carregarProdutosPorCategoria(categoriaSanitizada);
    mostrarMensagem(`Produto "${nomeProdutoSanitizado}" adicionado à categoria "${categoriaSanitizada}" com sucesso!`, 'success');
  } catch (error) {
    console.error('Erro ao adicionar produto:', error);
    mostrarMensagem('Falha ao adicionar o produto. Tente novamente.');
  } finally {
    form.querySelector('#adicionar-btn').disabled = false;
  }
}

// Excluir produtos
async function excluirProdutos(idsProdutos) {
  try {
    const { error: deleteError } = await db
      .from('estoque')
      .delete()
      .in('id', idsProdutos);

    if (deleteError) throw new Error(`Erro ao excluir produtos: ${deleteError.message}`);

    const { error: deleteMovError } = await db
      .from('movimentacoes_estoque')
      .delete()
      .in('id_produto', idsProdutos);

    if (deleteMovError) throw new Error(`Erro ao excluir movimentações: ${deleteMovError.message}`);

    let categoriasAfetadas = new Set();
    idsProdutos.forEach(idProduto => {
      Object.keys(produtosPorCategoria).forEach(categoria => {
        const produtoIndex = produtosPorCategoria[categoria].findIndex(p => p.id === idProduto);
        if (produtoIndex !== -1) {
          produtosPorCategoria[categoria].splice(produtoIndex, 1);
          if (produtosPorCategoria[categoria].length === 0) {
            delete produtosPorCategoria[categoria];
            const selectCategoria = document.getElementById('categoria');
            const option = selectCategoria.querySelector(`option[value="${categoria}"]`);
            if (option) option.remove();
          }
          categoriasAfetadas.add(categoria);
        }
      });
    });

    const categoriaSelecionada = document.getElementById('categoria').value;
    if (categoriaSelecionada === 'Favoritos' || categoriasAfetadas.has(categoriaSelecionada)) {
      await carregarProdutosPorCategoria(categoriaSelecionada);
    }
    mostrarMensagem(`${idsProdutos.length} produto(s) excluído(s) com sucesso!`, 'success');
  } catch (error) {
    console.error('Erro ao excluir produtos:', error);
    mostrarMensagem('Falha ao excluir produtos. Tente novamente.');
  }
}

// Atualizar estoque
async function atualizarEstoque(idProduto, grades, unidades, descricao) {
  try {
    const gradesNum = parseInt(grades) || 0;
    const unidadesNum = parseInt(unidades) || 0;

    if (!validarInputs(gradesNum, unidadesNum)) return;

    const novaQuantidade = (gradesNum * 12) + unidadesNum;

    const { error: updateError } = await db
      .from('estoque')
      .update({ quantidade: novaQuantidade })
      .eq('id', idProduto);

    if (updateError) throw new Error(`Erro ao atualizar estoque: ${updateError.message}`);

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

    if (insertError) throw new Error(`Erro ao registrar movimentação: ${insertError.message}`);

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
      if (quantidadeCell) quantidadeCell.textContent = novaQuantidade;
    }

    const gradesInput = document.getElementById(`grades-${idProduto}`);
    const unidadesInput = document.getElementById(`unidades-${idProduto}`);
    if (gradesInput) gradesInput.value = '';
    if (unidadesInput) unidadesInput.value = '';

    const mostrarGrades = categoriaAtual === "1 - Cervejas LITRÃO";
    const mensagemGrades = mostrarGrades && gradesNum > 0 ? `${gradesNum} grades + ` : '';
    mostrarMensagem(`Estoque atualizado com sucesso. Total: ${novaQuantidade} unidades (${mensagemGrades}${unidadesNum} unidades)`, 'success');

    if (categoriaAtual && categoriaAtual !== '' && categoriaAtual !== 'Favoritos' && categoriaProduto === categoriaAtual) {
      await carregarProdutosPorCategoria(categoriaAtual);
    } else if (categoriaAtual === 'Favoritos') {
      await carregarProdutosPorCategoria('Favoritos');
    }
  } catch (error) {
    console.error('Erro ao atualizar estoque:', error);
    mostrarMensagem('Falha ao atualizar o estoque. Tente novamente.');
  }
}

// Adicionar estoque
async function adicionarEstoque(idProduto, grades, unidades, descricao) {
  try {
    const gradesNum = parseInt(grades) || 0;
    const unidadesNum = parseInt(unidades) || 0;

    if (!validarInputs(gradesNum, unidadesNum)) return;

    const { data: produto, error: fetchError } = await db
      .from('estoque')
      .select('quantidade')
      .eq('id', idProduto)
      .single();

    if (fetchError || !produto) throw new Error('Produto não encontrado.');

    const quantidadeAtual = produto.quantidade || 0;
    const quantidadeAdicional = (gradesNum * 12) + unidadesNum;
    const novaQuantidade = quantidadeAtual + quantidadeAdicional;

    const { error: updateError } = await db
      .from('estoque')
      .update({ quantidade: novaQuantidade })
      .eq('id', idProduto);

    if (updateError) throw new Error(`Erro ao atualizar estoque: ${updateError.message}`);

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

    if (insertError) throw new Error(`Erro ao registrar movimentação: ${insertError.message}`);

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
      if (quantidadeCell) quantidadeCell.textContent = novaQuantidade;
    }

    const gradesInput = document.getElementById(`grades-${idProduto}`);
    const unidadesInput = document.getElementById(`unidades-${idProduto}`);
    if (gradesInput) gradesInput.value = '';
    if (unidadesInput) unidadesInput.value = '';

    const mostrarGrades = categoriaAtual === "1 - Cervejas LITRÃO";
    const mensagemGrades = mostrarGrades && gradesNum > 0 ? `${gradesNum} grades + ` : '';
    mostrarMensagem(`Estoque atualizado. Estoque atual: ${quantidadeAtual} unidades. Adicionado: ${quantidadeAdicional} unidades (${mensagemGrades}${unidadesNum} unidades). Novo total: ${novaQuantidade} unidades`, 'success');

    if (categoriaAtual && categoriaAtual !== '' && categoriaAtual !== 'Favoritos' && categoriaProduto === categoriaAtual) {
      await carregarProdutosPorCategoria(categoriaAtual);
    } else if (categoriaAtual === 'Favoritos') {
      await carregarProdutosPorCategoria('Favoritos');
    }
  } catch (error) {
    console.error('Erro ao adicionar estoque:', error);
    mostrarMensagem('Falha ao adicionar ao estoque. Tente novamente.');
  }
}

// Carregar comparação de um dia
async function carregarComparacao() {
  const dataComparacao = document.getElementById('data-comparacao').value;
  if (!dataComparacao) {
    mostrarMensagem('Selecione uma data para comparação.');
    return;
  }

  try {
    document.getElementById('resultado-comparacao').innerHTML = '<p class="loading">Carregando comparação...</p>';

    const dataInicio = `${dataComparacao}T00:00:00`;
    const dataFim = `${dataComparacao}T23:59:59`;

    const { data: movimentacoes, error } = await db
      .from('movimentacoes_estoque')
      .select('id_produto,quantidade,tipo_movimentacao,descricao,created_at')
      .gte('created_at', dataInicio)
      .lte('created_at', dataFim);

    if (error) throw new Error(`Erro ao carregar movimentações: ${error.message}`);

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

// Carregar comparação de três dias
async function carregarComparacaoTresDias() {
  const dataFinal = document.getElementById('data-comparacao-tres-dias').value;
  if (!dataFinal) {
    mostrarMensagem('Selecione uma data final para comparação.');
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
      .select('id,produto,categoria,quantidade');

    if (produtosError) throw new Error(`Erro ao carregar produtos: ${produtosError.message}`);

    const { data: movimentacoes, error: movError } = await db
      .from('movimentacoes_estoque')
      .select('id_produto,quantidade,created_at')
      .gte('created_at', `${dataDia3}T00:00:00`)
      .lte('created_at', `${dataDia1}T23:59:59`);

    if (movError) throw new Error(`Erro ao carregar movimentações: ${movError.message}`);

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
        if (movDate === dataDia3) estoquePorDia[prodId].quantidadeDia3 = mov.quantidade;
        else if (movDate === dataDia2) estoquePorDia[prodId].quantidadeDia2 = mov.quantidade;
        else if (movDate === dataDia1) estoquePorDia[prodId].quantidadeDia1 = mov.quantidade;
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
      if (!produtosPorCategoria[prod.categoria]) produtosPorCategoria[prod.categoria] = [];
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

// Debounce para redimensionamento
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

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const hojeManaus = formatarDataLocal(obterDataManaus());
    const dataRegistro = document.getElementById('data-registro');
    const dataComparacao = document.getElementById('data-comparacao');
    const dataComparacaoTresDias = document.getElementById('data-comparacao-tres-dias');

    if (dataRegistro) dataRegistro.value = hojeManaus;
    if (dataComparacao) dataComparacao.value = hojeManaus;
    if (dataComparacaoTresDias) dataComparacaoTresDias.value = hojeManaus;

    await carregarDadosIniciais();

    document.getElementById('categoria').addEventListener('change', async (e) => {
      await carregarProdutosPorCategoria(e.target.value);
    });

    const debouncedCarregarProdutos = debounce(async () => {
      const categoria = document.getElementById('categoria').value;
      if (categoria) await carregarProdutosPorCategoria(categoria);
    }, 300);

    window.addEventListener('resize', debouncedCarregarProdutos);
  } catch (error) {
    console.error("Erro na inicialização:", error);
    mostrarMensagem('Erro ao inicializar o sistema. Tente recarregar a página.');
  }
});
