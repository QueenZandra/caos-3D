import { GameManager } from "./systems/GameManager";

async function boot(): Promise<void> {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
  const loading = document.getElementById("loading");

  const game = new GameManager(canvas);
  try {
    await game.start();
  } catch (err) {
    console.error("Falha ao iniciar o jogo:", err);
    if (loading) {
      loading.querySelector(".sub")!.textContent = "Erro ao carregar. Veja o console.";
      return;
    }
  }

  // some com a tela de carregamento
  if (loading) {
    loading.style.opacity = "0";
    setTimeout(() => loading.remove(), 400);
  }
}

boot();
