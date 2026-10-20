(() => {
  "use strict";

  const ATTEMPT_LIMIT = 6;
  const WORD_LENGTH = 5;
  const SESSION_KEY = "palavra-do-dia:session:v1";
  const PROGRESS_PREFIX = "palavra-do-dia:progress:v1:";
  const board = document.getElementById("board");
  const form = document.getElementById("guess-form");
  const input = document.getElementById("guess-input");
  const submitButton = document.getElementById("submit-button");
  const counter = document.getElementById("attempt-counter");
  const dateLabel = document.getElementById("game-date");
  const message = document.getElementById("game-message");
  const keyboard = document.getElementById("keyboard");
  let puzzle = null;
  let game = { guesses: [], status: "loading" };
  let sessionId = null;
  let pendingGuess = null;
  let pendingRequestId = null;
  let sending = false;
  const tiles = [];
  const letterKeys = new Map();

  function normalizeWord(value) {
    return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleUpperCase("pt-BR");
  }

  function announce(text, kind = "") {
    message.textContent = text;
    message.className = `game-message ${kind}`.trim();
  }

  function readStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      console.warn("O armazenamento local não está disponível.", error);
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      console.warn("Não foi possível salvar o progresso neste dispositivo.", error);
      announce("O progresso desta partida não pôde ser salvo neste dispositivo.", "error");
      return false;
    }
  }

  function getSessionId() {
    const saved = readStorage(SESSION_KEY);
    if (saved && /^[0-9a-f-]{36}$/i.test(saved)) return saved;
    const created = window.crypto.randomUUID();
    writeStorage(SESSION_KEY, created);
    return created;
  }

  async function request(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.message || "Não foi possível concluir a solicitação.");
      error.code = payload.code || "REQUEST_FAILED";
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  function buildBoard() {
    for (let rowIndex = 0; rowIndex < ATTEMPT_LIMIT; rowIndex += 1) {
      const row = document.createElement("div");
      row.className = "board-row";
      row.setAttribute("role", "group");
      row.setAttribute("aria-label", `Tentativa ${rowIndex + 1}`);
      const rowTiles = [];
      for (let columnIndex = 0; columnIndex < WORD_LENGTH; columnIndex += 1) {
        const tile = document.createElement("div");
        tile.className = "tile";
        tile.setAttribute("aria-hidden", "true");
        row.append(tile);
        rowTiles.push(tile);
      }
      board.append(row);
      tiles.push(rowTiles);
    }
  }

  function buildKeyboard() {
    keyboard.querySelectorAll(".keyboard-row").forEach((row, rowIndex) => {
      if (rowIndex === 2) {
        row.append(createActionKey("Enviar", "Enviar tentativa", () => form.requestSubmit()));
      }
      [...row.dataset.row].forEach(letter => {
        const key = document.createElement("button");
        key.type = "button";
        key.className = "key";
        key.textContent = letter;
        key.setAttribute("aria-label", `Letra ${letter}`);
        key.addEventListener("click", () => addLetter(normalizeWord(letter)));
        row.append(key);
        const normalized = normalizeWord(letter);
        const related = letterKeys.get(normalized) || [];
        related.push(key);
        letterKeys.set(normalized, related);
      });
      if (rowIndex === 2) {
        row.append(createActionKey("Apagar", "Apagar última letra", removeLetter));
      }
    });
  }

  function createActionKey(label, accessibleName, action) {
    const key = document.createElement("button");
    key.type = "button";
    key.className = "key action";
    key.textContent = label;
    key.setAttribute("aria-label", accessibleName);
    key.addEventListener("click", action);
    return key;
  }

  function addLetter(letter) {
    if (game.status !== "playing" || sending || normalizeWord(input.value).length >= WORD_LENGTH) return;
    input.value = normalizeWord(input.value) + letter;
    render();
    input.focus();
    announce("");
  }

  function removeLetter() {
    if (game.status !== "playing" || sending) return;
    input.value = normalizeWord(input.value).slice(0, -1);
    render();
    input.focus();
    announce("");
  }

  function saveProgress() {
    if (!puzzle || !sessionId) return;
    const progress = {
      version: 1,
      puzzleId: puzzle.puzzleId,
      guesses: game.guesses,
      status: game.status,
      updatedAt: new Date().toISOString()
    };
    writeStorage(`${PROGRESS_PREFIX}${puzzle.puzzleId}`, JSON.stringify(progress));
  }

  function validateProgress(saved) {
    return saved &&
      saved.version === 1 &&
      saved.puzzleId === puzzle.puzzleId &&
      Array.isArray(saved.guesses) &&
      saved.guesses.length <= ATTEMPT_LIMIT &&
      saved.guesses.every(guess =>
        guess &&
        typeof guess.normalizedGuess === "string" &&
        /^[A-Z]{5}$/.test(guess.normalizedGuess) &&
        Array.isArray(guess.marks) &&
        guess.marks.length === WORD_LENGTH &&
        guess.marks.every(mark => ["correct", "present", "absent"].includes(mark))
      ) &&
      ["playing", "won", "lost"].includes(saved.status);
  }

  function restoreLocalProgress() {
    const raw = readStorage(`${PROGRESS_PREFIX}${puzzle.puzzleId}`);
    if (!raw) return false;
    try {
      const saved = JSON.parse(raw);
      if (!validateProgress(saved)) {
        announce("O progresso salvo não pôde ser validado; começamos uma nova partida.", "error");
        return false;
      }
      game = { guesses: saved.guesses, status: saved.status };
      return true;
    } catch (error) {
      console.warn("O progresso salvo está malformado.", error);
      announce("O progresso salvo não pôde ser lido; começamos uma nova partida.", "error");
      return false;
    }
  }

  function render() {
    const activeRow = game.guesses.length;
    tiles.forEach((rowTiles, rowIndex) => {
      rowTiles.forEach((tile, columnIndex) => {
        tile.className = "tile";
        tile.replaceChildren();
        tile.removeAttribute("aria-label");
        if (rowIndex < game.guesses.length) {
          const guess = game.guesses[rowIndex];
          const letter = guess.normalizedGuess[columnIndex];
          const mark = guess.marks[columnIndex];
          tile.classList.add(mark);
          tile.append(document.createTextNode(letter));
          const symbol = document.createElement("span");
          symbol.className = "tile-symbol";
          symbol.setAttribute("aria-hidden", "true");
          symbol.textContent = mark === "correct" ? "✓" : mark === "present" ? "↔" : "×";
          tile.append(symbol);
          const spokenMark = mark === "correct"
            ? "correta e na posição certa"
            : mark === "present"
              ? "na palavra em outra posição"
              : "não está na palavra";
          tile.setAttribute("aria-label", `${letter}, posição ${columnIndex + 1}: ${spokenMark}`);
          tile.removeAttribute("aria-hidden");
        } else if (rowIndex === activeRow && game.status === "playing") {
          const letters = normalizeWord(input.value);
          if (columnIndex < letters.length) {
            tile.classList.add("filled");
            tile.append(document.createTextNode(letters[columnIndex]));
          }
          tile.setAttribute("aria-hidden", "true");
        } else {
          tile.setAttribute("aria-hidden", "true");
        }
      });
    });

    const keyRanks = { correct: 3, present: 2, absent: 1 };
    const keyStatus = new Map();
    game.guesses.forEach(guess => guess.marks.forEach((mark, index) => {
      const letter = guess.normalizedGuess[index];
      if (!keyStatus.has(letter) || keyRanks[mark] > keyRanks[keyStatus.get(letter)]) keyStatus.set(letter, mark);
    }));
    letterKeys.forEach((buttons, letter) => {
      const mark = keyStatus.get(letter);
      const result = mark === "correct"
        ? "correta na posição certa"
        : mark === "present"
          ? "presente em outra posição"
          : mark === "absent"
            ? "ausente"
            : "ainda não tentada";
      buttons.forEach(button => {
        button.classList.remove("correct", "present", "absent");
        if (mark) button.classList.add(mark);
        button.setAttribute("aria-label", `Letra ${button.textContent}, ${result}`);
      });
    });

    const remaining = Math.max(0, ATTEMPT_LIMIT - game.guesses.length);
    counter.replaceChildren(document.createTextNode(String(remaining)));
    const counterLabel = remaining === 1 ? "chance" : "chances";
    counter.append(document.createElement("span"));
    counter.lastElementChild.textContent = counterLabel;
    counter.setAttribute("aria-label", `${remaining} ${counterLabel} restantes`);

    const finished = ["won", "lost"].includes(game.status);
    input.disabled = game.status !== "playing" || sending;
    submitButton.disabled = game.status !== "playing" || sending;
    keyboard.querySelectorAll("button").forEach(key => {
      key.disabled = game.status !== "playing" || sending;
    });
    if (game.status === "loading") {
      input.disabled = true;
      submitButton.disabled = true;
    }
    if (finished) {
      document.getElementById("game-title").textContent = game.status === "won" ? "Você conseguiu!" : "Fim de jogo";
      document.getElementById("guess-hint").textContent = "O desafio de hoje foi concluído.";
    }
  }

  function formatDate(dateValue) {
    const date = new Date(`${dateValue}T12:00:00-03:00`);
    return new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "America/Sao_Paulo"
    }).format(date);
  }

  function describeResult(guess, marks, attemptsUsed) {
    const details = guess.split("").map((letter, index) => {
      const result = marks[index] === "correct"
        ? "posição certa"
        : marks[index] === "present"
          ? "está na palavra, em outra posição"
          : "não aparece na palavra";
      return `${letter}, ${result}`;
    });
    return `Tentativa ${attemptsUsed} de ${ATTEMPT_LIMIT}. ${details.join(". ")}.`;
  }

  async function submitGuess() {
    if (game.status !== "playing" || sending) return;
    const guess = normalizeWord(input.value);
    if (!/^[A-Z]{5}$/.test(guess)) {
      announce("Digite uma palavra com 5 letras para tentar.", "error");
      input.focus();
      return;
    }

    if (pendingGuess !== guess || !pendingRequestId) pendingRequestId = window.crypto.randomUUID();
    pendingGuess = guess;
    sending = true;
    render();
    announce("Conferindo sua palavra…");
    try {
      const result = await request(`/api/v1/puzzles/${encodeURIComponent(puzzle.puzzleId)}/guesses`, {
        method: "POST",
        body: JSON.stringify({ sessionId, guess, requestId: pendingRequestId })
      });
      if (!result.accepted) throw new Error("O serviço não confirmou a tentativa.");
      game.guesses.push({ normalizedGuess: guess, marks: result.marks });
      game.status = result.status;
      pendingGuess = null;
      pendingRequestId = null;
      input.value = "";
      saveProgress();
      render();
      if (game.status === "won") {
        announce(`Boa! Você encontrou a palavra: ${result.answer}.`, "success");
      } else if (game.status === "lost") {
        announce(`Fim de jogo. A palavra era: ${result.answer}.`, "error");
      } else {
        announce(describeResult(guess, result.marks, result.attemptsUsed));
      }
      if (game.status === "playing") input.focus();
    } catch (error) {
      pendingGuess = guess;
      render();
      if (error.code === "WORD_NOT_ALLOWED") {
        pendingGuess = null;
        pendingRequestId = null;
        announce("Essa palavra não está na lista. Tente outra palavra.", "error");
      } else if (error.code === "INVALID_LENGTH") {
        announce("Digite 5 letras para tentar.", "error");
      } else if (error.code === "GAME_FINISHED" && error.payload?.state) {
        applyServerState(error.payload.state);
        render();
        if (error.payload.state.answer) announce(`Partida concluída. A palavra era: ${error.payload.state.answer}.`, "success");
      } else {
        console.error("Falha ao verificar a tentativa.", error);
        announce("Não foi possível verificar agora. Sua palavra continua no campo; tente de novo.", "error");
      }
      input.focus();
    } finally {
      sending = false;
      render();
      if (game.status === "playing") input.focus();
    }
  }

  function applyServerState(state) {
    if (!state || !Array.isArray(state.guesses) || !["playing", "won", "lost"].includes(state.status)) {
      throw new Error("O servidor retornou um estado de jogo inválido.");
    }
    game = {
      guesses: state.guesses.map(guess => ({
        normalizedGuess: guess.normalizedGuess,
        marks: guess.marks
      })),
      status: state.status
    };
  }

  async function startGame() {
    game.status = "loading";
    render();
    announce("Carregando o desafio de hoje…");
    try {
      sessionId = getSessionId();
      puzzle = await request(`/api/v1/puzzles/today?sessionId=${encodeURIComponent(sessionId)}`);
      if (!puzzle.puzzleId || puzzle.wordLength !== WORD_LENGTH || puzzle.maxAttempts !== ATTEMPT_LIMIT) {
        throw new Error("A configuração do desafio recebido é inválida.");
      }
      dateLabel.textContent = formatDate(puzzle.date);
      const localProgressFound = restoreLocalProgress();
      try {
        const serverState = await request(`/api/v1/puzzles/${encodeURIComponent(puzzle.puzzleId)}/state?sessionId=${encodeURIComponent(sessionId)}`);
        applyServerState(serverState);
        saveProgress();
      } catch (error) {
        if (error.status !== 404) throw error;
        if (!localProgressFound) game = { guesses: [], status: "playing" };
      }
      if (game.status === "won") {
        document.getElementById("game-title").textContent = "Você conseguiu!";
        announce("Você já encontrou a palavra de hoje.", "success");
      } else if (game.status === "lost") {
        document.getElementById("game-title").textContent = "Fim de jogo";
        announce("Você já concluiu o desafio de hoje.", "success");
      } else {
        document.getElementById("game-title").textContent = "Vamos nessa?";
        announce("Desafio pronto. Digite uma palavra de 5 letras.");
      }
      render();
      if (game.status === "playing") input.focus({ preventScroll: true });
    } catch (error) {
      console.error("Não foi possível carregar o desafio diário.", error);
      game = { guesses: [], status: "error" };
      render();
      input.disabled = true;
      submitButton.disabled = true;
      dateLabel.textContent = "Desafio indisponível";
      announce("Não conseguimos carregar o desafio agora. Verifique sua conexão e atualize a página.", "error");
    }
  }

  input.addEventListener("input", () => {
    input.value = normalizeWord(input.value).replace(/[^A-Z]/g, "").slice(0, WORD_LENGTH);
    render();
    if (message.classList.contains("error")) announce("");
  });
  form.addEventListener("submit", event => {
    event.preventDefault();
    submitGuess();
  });
  buildBoard();
  buildKeyboard();
  render();
  startGame();
})();
