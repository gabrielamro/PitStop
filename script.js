
const SUPABASE_URL = "https://mzahiyhvxxgegyyfmmbl.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16YWhpeWh2eHhnZWd5eWZtbWJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ0MzUzMzIsImV4cCI6MjA2MDAxMTMzMn0.IBwErJNVkeNUggCxXzZ0MsDldTRqAlqTAcWoxkX5gsU";
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const produtos = {
  "4 - Cervejas LONGNECK": ["Coronita"],
  "5 - REFRIGERANTES": ["Guaraná Antartica 2l"],
  "9- ENERGÉTICOS LATA": ["RedBull", "RedBull Pitaya", "RedBull Tropical"]
};

function mostrarSecao(secao) {
  document.getElementById("registro").style.display = secao === "registro" ? "block" : "none";
  document.getElementById("comparar").style.display = secao === "comparar" ? "block" : "none";
}

function toggleSidebar() {
  const sidebar = document.getElementById("sidebar");
  sidebar.classList.toggle("collapsed");
}

function filtrarProdutos() {
  const categoria = document.getElementById("categoria").value;
  const lista = document.getElementById("produtos-lista");
  lista.innerHTML = "";

  if (categoria && produtos[categoria]) {
    let html = `
      <table class="produto-tabela">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Categoria</th>
            <th>Estoque</th>
          </tr>
        </thead>
        <tbody>
    `;

    produtos[categoria].forEach(produto => {
      html += `
        <tr>
          <td>${produto}</td>
          <td>${categoria}</td>
          <td>
            <input id="campo-${produto}" type="number" value="0" class="input-estoque">
            <button onclick="salvarViaBotao('${produto}', '${categoria}')">Salvar</button>
          </td>
        </tr>
      `;
    });

    html += "</tbody></table>";
    lista.innerHTML = html;

    const hoje = new Date().toISOString().split("T")[0];
    produtos[categoria].forEach(async produto => {
      const { data, error } = await db
        .from("estoque")
        .select("quantidade")
        .eq("produto", produto)
        .filter("data", "eq", hoje)
        .maybeSingle();

      if (data && data.quantidade !== undefined) {
        const campo = document.getElementById("campo-" + produto);
        if (campo) campo.value = data.quantidade;
      }
    });
  }
}

async function salvarEdicao(elemento, produto, categoria) {
  const valor = parseInt(elemento.value);
  if (isNaN(valor)) {
    alert("Valor inválido para " + produto);
    elemento.value = "0";
    return;
  }

  const dataHoje = new Date().toISOString().split("T")[0];

  const { data: existente } = await db
    .from("estoque")
    .select("id")
    .eq("produto", produto)
    .filter("data", "eq", dataHoje)
    .maybeSingle();

  if (existente && existente.id) {
    await db.from("estoque").update({ quantidade: valor }).eq("id", existente.id);
  } else {
    await db.from("estoque").insert([{ produto, categoria, data: dataHoje, quantidade: valor }]);
  }

  elemento.style.backgroundColor = "#d4ffd4";
  setTimeout(() => elemento.style.backgroundColor = "", 1000);
}

function salvarViaBotao(produto, categoria) {
  const campo = document.getElementById("campo-" + produto);
  if (campo) salvarEdicao(campo, produto, categoria);
}

function testarConexao() {
  db.from("estoque").select("*").limit(1).then(({ error }) => {
    if (error) {
      alert("❌ Erro na conexão com o Supabase.");
      console.error(error);
    } else {
      alert("✅ Conexão com o Supabase funcionando!");
    }
  });
}

async function carregarComparacao() {
  const produto = document.getElementById("produto-comp").value.trim();
  const tabela = document.getElementById("tabelaComparacao").querySelector("tbody");
  tabela.innerHTML = "";

  if (!produto) {
    alert("Digite o nome de um produto para comparar.");
    return;
  }

  const { data: registros, error } = await db
    .from("estoque")
    .select("data, quantidade")
    .eq("produto", produto)
    .order("data", { ascending: false })
    .limit(6);

  if (error || !registros) {
    console.error(error);
    return;
  }

  const ordenado = registros.reverse();
  for (let i = 0; i < ordenado.length; i++) {
    const atual = ordenado[i];
    const anterior = ordenado[i - 1];
    const vendido = anterior ? anterior.quantidade - atual.quantidade : "—";
    tabela.innerHTML += `
      <tr>
        <td>${atual.data}</td>
        <td>${atual.quantidade}</td>
        <td>${vendido}</td>
      </tr>
    `;
  }
}
