"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, describe, it } = require("node:test");
const { randomUUID } = require("node:crypto");

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "palavra-do-dia-"));
process.env.GAME_DATA_DIR = testDataDir;
const { createServer, getAnswer, getPuzzleId } = require("../server");
const { evaluateGuess, normalizeWord } = require("../src/game-rules");
const vocabulary = require("../data/words.json");
let server;
let baseUrl;

after(async () => {
  if (server?.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  fs.rmSync(testDataDir, { recursive: true, force: true });
});

describe("regras da partida", () => {
  it("normaliza caracteres acentuados e mantém o tamanho após normalização", () => {
    assert.equal(normalizeWord("limão"), "LIMAO");
    assert.equal(normalizeWord("MARÇO"), "MARCO");
  });

  it("avalia letras exatas antes de consumir ocorrências repetidas", () => {
    assert.deepEqual(evaluateGuess("MAMAS", "LIMAO"), [
      "absent", "absent", "correct", "correct", "absent"
    ]);
    assert.deepEqual(evaluateGuess("AAAAA", "LIMAO"), [
      "absent", "absent", "absent", "correct", "absent"
    ]);
  });

  it("contém apenas palavras de cinco letras e respostas sem colisões por acento", () => {
    const normalizedAnswers = new Set();
    for (const entry of vocabulary.words) {
      assert.match(normalizeWord(entry.word), /^[A-Z]{5}$/, `${entry.word} deve ter cinco letras normalizadas`);
      if (entry.answer) {
        const normalized = normalizeWord(entry.word);
        assert.equal(normalizedAnswers.has(normalized), false, `${entry.word} colide com outra resposta`);
        normalizedAnswers.add(normalized);
      }
    }
  });
});

describe("API diária", () => {
  it("valida vocabulário, idempotência, limite de tentativas e revelação ao fim", async () => {
    server = await createServer();
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    const sessionId = randomUUID();
    const todayResponse = await fetch(`${baseUrl}/api/v1/puzzles/today?sessionId=${sessionId}`);
    assert.equal(todayResponse.status, 200);
    const today = await todayResponse.json();
    assert.equal(today.date, getPuzzleId());
    assert.equal(today.wordLength, 5);
    assert.equal("answer" in today, false);

    const invalidResponse = await fetch(`${baseUrl}/api/v1/puzzles/${today.puzzleId}/guesses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, guess: "ZZZZZ", requestId: randomUUID() })
    });
    assert.equal(invalidResponse.status, 422);
    assert.equal((await invalidResponse.json()).code, "WORD_NOT_ALLOWED");

    const answer = getAnswer(today.puzzleId).normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
    const wrongGuess = vocabulary.words.find(entry => entry.answer && normalizeWord(entry.word) !== answer);
    assert.ok(wrongGuess, "deve haver uma resposta de teste diferente da solução do dia");
    const requestId = randomUUID();
    const guessPayload = { sessionId, guess: normalizeWord(wrongGuess.word), requestId };
    const firstTry = await fetch(`${baseUrl}/api/v1/puzzles/${today.puzzleId}/guesses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(guessPayload)
    });
    assert.equal(firstTry.status, 200);
    const firstResult = await firstTry.json();
    assert.equal(firstResult.attemptsUsed, 1);
    assert.equal("answer" in firstResult, false);

    const retry = await fetch(`${baseUrl}/api/v1/puzzles/${today.puzzleId}/guesses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(guessPayload)
    });
    assert.deepEqual(await retry.json(), firstResult);

    let lastResult = firstResult;
    for (let attempt = 2; attempt <= 6; attempt += 1) {
      const response = await fetch(`${baseUrl}/api/v1/puzzles/${today.puzzleId}/guesses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, guess: normalizeWord(wrongGuess.word), requestId: randomUUID() })
      });
      assert.equal(response.status, 200);
      lastResult = await response.json();
    }
    assert.equal(lastResult.status, "lost");
    assert.equal(lastResult.answer, getAnswer(today.puzzleId));

    const restored = await fetch(`${baseUrl}/api/v1/puzzles/${today.puzzleId}/state?sessionId=${sessionId}`);
    const restoredState = await restored.json();
    assert.equal(restoredState.status, "lost");
    assert.equal(restoredState.guesses.length, 6);
    assert.equal(restoredState.answer, getAnswer(today.puzzleId));
  });
});
