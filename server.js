"use strict";

const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { evaluateGuess, normalizeWord } = require("./src/game-rules");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const STATE_DIR = process.env.GAME_DATA_DIR || path.join(ROOT, "var");
const STATE_FILE = path.join(STATE_DIR, "sessions.json");
const TIME_ZONE = "America/Sao_Paulo";
const MAX_ATTEMPTS = 6;
const WORD_LENGTH = 5;
const MAX_BODY_SIZE = 4096;
const SESSION_ID_PATTERN = /^[0-9a-f-]{36}$/i;
const PUZZLE_ID_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PUBLIC_FILES = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
  ["/game.js", ["game.js", "text/javascript; charset=utf-8"]]
]);

let words;
let answers;
let sessions = {};
let mutationQueue = Promise.resolve();
let sessionStoreDir = STATE_DIR;
let sessionStoreFile = STATE_FILE;

function enqueueMutation(action) {
  const next = mutationQueue.then(action, action);
  mutationQueue = next.catch(error => {
    console.error("A atualização do estado do jogo falhou.", error);
  });
  return next;
}

function getPuzzleId(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getAnswer(puzzleId) {
  const day = Date.parse(`${puzzleId}T12:00:00Z`);
  const firstDay = Date.parse("2026-10-13T12:00:00Z");
  const dayIndex = Math.floor((day - firstDay) / 86_400_000);
  const answerIndex = ((dayIndex % answers.length) + answers.length) % answers.length;
  return answers[answerIndex];
}

function makePublicState(session, answer) {
  const result = {
    puzzleId: session.puzzleId,
    guesses: session.guesses,
    status: session.status
  };
  if (session.status === "won" || session.status === "lost") result.answer = answer;
  return result;
}

function loadSession(puzzleId, sessionId) {
  const key = `${puzzleId}:${sessionId}`;
  return sessions[key] || {
    puzzleId,
    sessionId,
    guesses: [],
    status: "playing",
    requests: {},
    updatedAt: new Date().toISOString()
  };
}

async function persistSessions() {
  await fs.mkdir(sessionStoreDir, { recursive: true });
  const tempFile = `${sessionStoreFile}.${randomUUID()}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(sessions), "utf8");
  await fs.rename(tempFile, sessionStoreFile);
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_SIZE) {
      const error = new Error("A solicitação excede o tamanho permitido.");
      error.status = 413;
      error.code = "PAYLOAD_TOO_LARGE";
      throw error;
    }
  }
  try {
    return JSON.parse(body);
  } catch {
    const error = new Error("A solicitação não contém JSON válido.");
    error.status = 400;
    error.code = "INVALID_JSON";
    throw error;
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(payload));
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/v1/puzzles/today") {
    const puzzleId = getPuzzleId();
    const sessionId = url.searchParams.get("sessionId");
    const payload = {
      puzzleId,
      date: puzzleId,
      wordLength: WORD_LENGTH,
      maxAttempts: MAX_ATTEMPTS,
      accentPolicy: "ignore-for-guess",
      sourceNote: "Vocabulário inicial curado para esta implementação."
    };
    if (sessionId && SESSION_ID_PATTERN.test(sessionId)) {
      const session = loadSession(puzzleId, sessionId);
      payload.state = makePublicState(session, getAnswer(puzzleId));
    }
    sendJson(response, 200, payload);
    return;
  }

  const stateMatch = url.pathname.match(/^\/api\/v1\/puzzles\/(\d{4}-\d{2}-\d{2})\/state$/);
  if (request.method === "GET" && stateMatch) {
    const [, puzzleId] = stateMatch;
    const sessionId = url.searchParams.get("sessionId");
    if (!SESSION_ID_PATTERN.test(sessionId || "")) {
      sendJson(response, 400, { code: "INVALID_SESSION", message: "A sessão desta partida é inválida." });
      return;
    }
    if (puzzleId !== getPuzzleId()) {
      sendJson(response, 404, { code: "PUZZLE_NOT_FOUND", message: "Este desafio não está disponível." });
      return;
    }
    const session = sessions[`${puzzleId}:${sessionId}`];
    if (!session) {
      sendJson(response, 404, { code: "SESSION_NOT_FOUND", message: "Ainda não há partida salva para este desafio." });
      return;
    }
    sendJson(response, 200, makePublicState(session, getAnswer(puzzleId)));
    return;
  }

  const guessMatch = url.pathname.match(/^\/api\/v1\/puzzles\/(\d{4}-\d{2}-\d{2})\/guesses$/);
  if (request.method === "POST" && guessMatch) {
    await handleGuess(request, response, guessMatch[1]);
    return;
  }

  sendJson(response, 404, { code: "NOT_FOUND", message: "Esse endereço da API não existe." });
}

async function handleGuess(request, response, puzzleId) {
  if (puzzleId !== getPuzzleId()) {
    sendJson(response, 404, { code: "PUZZLE_NOT_FOUND", message: "Este desafio não está disponível." });
    return;
  }
  const payload = await readJson(request);
  const { sessionId, requestId } = payload;
  if (!SESSION_ID_PATTERN.test(sessionId || "") || !SESSION_ID_PATTERN.test(requestId || "")) {
    sendJson(response, 400, { code: "INVALID_SESSION", message: "Atualize a página para iniciar uma nova sessão." });
    return;
  }
  if (typeof payload.guess !== "string") {
    sendJson(response, 400, { code: "INVALID_LENGTH", message: "Digite uma palavra de 5 letras." });
    return;
  }

  const normalizedGuess = normalizeWord(payload.guess);
  if (!/^[A-Z]{5}$/.test(normalizedGuess)) {
    sendJson(response, 400, { code: "INVALID_LENGTH", message: "Digite uma palavra de 5 letras." });
    return;
  }
  if (!words.has(normalizedGuess)) {
    sendJson(response, 422, { code: "WORD_NOT_ALLOWED", message: "Essa palavra não está na lista. Tente outra palavra." });
    return;
  }

  try {
    const result = await enqueueMutation(async () => {
      const key = `${puzzleId}:${sessionId}`;
      const session = loadSession(puzzleId, sessionId);
      if (session.requests[requestId]) return session.requests[requestId];
      if (session.status !== "playing") {
        return {
          statusCode: 409,
          payload: {
            code: "GAME_FINISHED",
            message: "Esta partida já foi concluída.",
            state: makePublicState(session, getAnswer(puzzleId))
          }
        };
      }
      if (session.guesses.length >= MAX_ATTEMPTS) {
        session.status = "lost";
        const finished = {
          statusCode: 409,
          payload: {
            code: "GAME_FINISHED",
            message: "Esta partida já foi concluída.",
            state: makePublicState(session, getAnswer(puzzleId))
          }
        };
        sessions[key] = session;
        await persistSessions();
        return finished;
      }

      const answer = normalizeWord(getAnswer(puzzleId));
      const marks = evaluateGuess(normalizedGuess, answer);
      session.guesses.push({ normalizedGuess, marks });
      session.status = normalizedGuess === answer
        ? "won"
        : session.guesses.length === MAX_ATTEMPTS
          ? "lost"
          : "playing";
      session.updatedAt = new Date().toISOString();
      const resultPayload = {
        accepted: true,
        marks,
        attemptsUsed: session.guesses.length,
        attemptsRemaining: MAX_ATTEMPTS - session.guesses.length,
        status: session.status
      };
      if (session.status === "won" || session.status === "lost") resultPayload.answer = getAnswer(puzzleId);
      const result = { statusCode: 200, payload: resultPayload };
      session.requests[requestId] = result;
      sessions[key] = session;
      await persistSessions();
      return result;
    });
    sendJson(response, result.statusCode, result.payload);
  } catch (error) {
    console.error("Não foi possível salvar a tentativa.", error);
    sendJson(response, 500, { code: "SERVICE_UNAVAILABLE", message: "Não foi possível verificar sua palavra agora." });
  }
}

async function serveFile(request, response, url) {
  const file = PUBLIC_FILES.get(url.pathname);
  if (!file || request.method !== "GET" && request.method !== "HEAD") {
    sendJson(response, 404, { code: "NOT_FOUND", message: "Página não encontrada." });
    return;
  }
  try {
    const content = await fs.readFile(path.join(ROOT, file[0]));
    response.writeHead(200, {
      "Content-Type": file[1],
      "Cache-Control": file[0] === "index.html" ? "no-cache" : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Content-Security-Policy": "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch (error) {
    console.error("Não foi possível servir o arquivo público.", error);
    sendJson(response, 500, { code: "STATIC_FILE_ERROR", message: "Não foi possível carregar a interface." });
  }
}

async function handleRequest(request, response) {
  let url;
  try {
    url = new URL(request.url, "http://localhost");
  } catch {
    sendJson(response, 400, { code: "INVALID_URL", message: "O endereço solicitado é inválido." });
    return;
  }
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }
    await serveFile(request, response, url);
  } catch (error) {
    console.error("Erro inesperado ao processar a solicitação.", error);
    if (!response.headersSent) {
      sendJson(response, error.status || 500, {
        code: error.code || "INTERNAL_ERROR",
        message: error.status ? error.message : "Ocorreu um erro interno. Tente novamente."
      });
    } else {
      response.destroy(error);
    }
  }
}

async function createServer(options = {}) {
  const stateDir = options.stateDir || STATE_DIR;
  const stateFile = path.join(stateDir, "sessions.json");
  const vocabularyFile = path.join(DATA_DIR, "words.json");
  let vocabulary;
  try {
    vocabulary = JSON.parse(await fs.readFile(vocabularyFile, "utf8"));
  } catch (error) {
    throw new Error(`Não foi possível carregar o vocabulário em ${vocabularyFile}: ${error.message}`);
  }
  const entries = vocabulary.words;
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("O vocabulário deve conter uma lista não vazia de palavras.");
  }
  words = new Set();
  answers = [];
  const normalizedAnswers = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry.word !== "string") throw new Error("Há uma entrada inválida no vocabulário.");
    const normalized = normalizeWord(entry.word);
    if (!/^[A-Z]{5}$/.test(normalized)) throw new Error(`A palavra "${entry.word}" não tem cinco letras válidas.`);
    words.add(normalized);
    if (entry.answer === true) {
      if (normalizedAnswers.has(normalized)) throw new Error(`Há respostas ambíguas após normalização: ${entry.word}.`);
      normalizedAnswers.add(normalized);
      answers.push(entry.word);
    }
  }
  if (answers.length === 0) throw new Error("O vocabulário não contém nenhuma resposta aprovada.");

  await fs.mkdir(stateDir, { recursive: true });
  try {
    const stored = JSON.parse(await fs.readFile(stateFile, "utf8"));
    if (stored && typeof stored === "object" && !Array.isArray(stored)) sessions = stored;
  } catch (error) {
    if (error.code !== "ENOENT") throw new Error(`Não foi possível ler as partidas salvas: ${error.message}`);
  }
  sessionStoreDir = stateDir;
  sessionStoreFile = stateFile;
  return http.createServer(handleRequest);
}

if (require.main === module) {
  const port = Number(process.env.PORT || 4173);
  createServer().then(server => {
    server.listen(port, "127.0.0.1", () => {
      console.log(`Palavra do Dia disponível em http://127.0.0.1:${port}`);
      console.log(`Fuso diário: ${TIME_ZONE}. Respostas na lista inicial: ${answers.length}.`);
    });
  }).catch(error => {
    console.error("Não foi possível iniciar o servidor do jogo.", error);
    process.exitCode = 1;
  });
}

module.exports = { createServer, getAnswer, getPuzzleId, handleRequest, makePublicState, normalizeWord };
