#!/usr/bin/env node
/**
 * A tiny stand-in for Radar MDE so browser tests can exercise the real daemon without next dev.
 * Usage: node fake-site.mjs <port>
 */
import http from "node:http";

const port = Number(process.argv[2]);

const shell = (title, body) => `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${title} · Radar MDE</title>
<style>
  .desk { display: flex; gap: 8px; }
  .phone { display: none; }
  @media (max-width: 767px) { .desk { display: none; } .phone { display: flex; } }
  @media (max-width: 459px) { .long { display: none; } }
  @media (min-width: 460px) { .short { display: none; } }
  dialog::backdrop { background: rgba(0,0,0,.3); }
</style></head>
<body>
<header>
  <a href="/">Radar MDE</a>
  <div class="desk"><nav aria-label="Principal"><a href="/">Painel</a> <a href="/sobre">Metodologia</a></nav></div>
  <div class="phone"><nav aria-label="Principal"><a href="/">Painel</a> <a href="/sobre"><span class="long">Metodologia</span><span class="short">Método</span></a></nav></div>
</header>
<main id="conteudo">${body}</main>
</body></html>`;

const home = shell(
  "Início",
  `<h1>Início</h1>
  <button id="save" aria-pressed="false">Salvar</button>
  <ul><li id="row">Santo André <button id="remove">Remover Santo André dos salvos</button></li></ul>
  <button id="open">Abrir diálogo</button>
  <dialog id="dlg" aria-label="Diálogo de teste"><p>Aberto</p><button id="close">Fechar</button></dialog>
  <a href="/">Este endereço</a>
  <a href="/slow">Página lenta</a>
  <a href="/client" id="client">Rota cliente</a>
  <a href="/stuck" id="stuck">Link preso</a>
  <textarea aria-label="Carta para a prefeitura">Prezada prefeita, Ana Costa</textarea>
  <input aria-label="Nome" value="Ana Costa">
  <button id="wa">Enviar no WhatsApp</button>
  <a href="mailto:?subject=Radar">E-mail</a>
  <a href="https://example.org/fonte" target="_blank" rel="noreferrer">Fonte externa</a>
  <script>
    const save = document.getElementById("save");
    save.onclick = () => { const on = save.textContent === "Salvar"; save.textContent = on ? "Salvo" : "Salvar"; save.setAttribute("aria-pressed", String(on)); };
    document.getElementById("remove").onclick = () => document.getElementById("row").remove();
    const dlg = document.getElementById("dlg");
    document.getElementById("open").onclick = () => dlg.showModal();
    document.getElementById("close").onclick = () => dlg.close();
    document.getElementById("client").onclick = (e) => { e.preventDefault(); setTimeout(() => { history.pushState({}, "", "/client"); document.querySelector("h1").textContent = "Cliente"; }, 900); };
    document.getElementById("stuck").onclick = (e) => e.preventDefault();
    document.getElementById("wa").onclick = () => window.open("https://wa.me/?text=Radar%20MDE", "_blank", "noopener");
  </script>`,
);

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
  const send = (status, html) => {
    res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  };
  if (url.pathname === "/") return send(200, home);
  if (url.pathname === "/sobre") return send(200, shell("Metodologia", "<h1>Metodologia</h1>"));
  if (url.pathname === "/client") return send(200, shell("Cliente", "<h1>Cliente</h1>"));
  if (url.pathname === "/slow") return void setTimeout(() => send(200, shell("Lenta", "<h1>Lenta</h1>")), 1200);
  return send(404, shell("Não encontrada", "<h1>Página não encontrada</h1>"));
});

server.listen(port, "127.0.0.1");
