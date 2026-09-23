(function () {
  "use strict";

  var QUIZ_URL = "data/quiz.json";
  var DOMAIN_NAMES = {
    1: "Identidad, acceso y gobernanza",
    2: "Almacenamiento, datos y red",
    3: "Cómputo seguro",
    4: "Postura y monitorización"
  };

  var state = {
    questions: [],
    filter: "all",
    answers: {}
  };

  document.addEventListener("DOMContentLoaded", function () {
    initHeader();
    initTabs();
    initCollapsibles();
    initSmoothScroll();
    initReveal();
    loadQuiz();
  });

  function initHeader() {
    var header = document.getElementById("site-header");
    if (!header) return;
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  function initTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
    if (!tabs.length) return;
    var panels = Array.prototype.slice.call(
      document.querySelectorAll('[role="tabpanel"]')
    );

    function activate(tab, focus) {
      tabs.forEach(function (t) {
        var selected = t === tab;
        t.setAttribute("aria-selected", String(selected));
        t.tabIndex = selected ? 0 : -1;
        t.classList.toggle("is-active", selected);
      });
      panels.forEach(function (panel) {
        var match = panel.id === tab.getAttribute("aria-controls");
        panel.hidden = !match;
        panel.classList.toggle("is-active", match);
      });
      if (focus) tab.focus();
    }

    tabs.forEach(function (tab, index) {
      tab.addEventListener("click", function () {
        activate(tab, false);
      });
      tab.addEventListener("keydown", function (event) {
        var next = null;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          next = tabs[(index + 1) % tabs.length];
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          next = tabs[(index - 1 + tabs.length) % tabs.length];
        } else if (event.key === "Home") {
          next = tabs[0];
        } else if (event.key === "End") {
          next = tabs[tabs.length - 1];
        }
        if (next) {
          event.preventDefault();
          activate(next, true);
        }
      });
    });
  }

  function initCollapsibles() {
    var toggles = document.querySelectorAll(".collapsible__toggle");
    toggles.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var item = btn.closest(".collapsible");
        if (!item) return;
        var open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", String(!open));
        item.classList.toggle("is-open", !open);
      });
    });
  }

  function initSmoothScroll() {
    document.addEventListener("click", function (event) {
      var link = event.target.closest('a[href^="#"]');
      if (!link) return;
      var hash = link.getAttribute("href");
      if (!hash || hash.length < 2) return;
      var target = document.querySelector(hash);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      if (history.pushState) {
        history.pushState(null, "", hash);
      }
    });
  }

  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    items.forEach(function (el) {
      observer.observe(el);
    });
  }

  function loadQuiz() {
    var list = document.getElementById("quiz-list");
    if (!list) return;
    fetch(QUIZ_URL)
      .then(function (response) {
        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        var questions = Array.isArray(data) ? data : data.questions;
        if (!Array.isArray(questions) || !questions.length) {
          throw new Error("formato inválido");
        }
        state.questions = questions;
        renderQuiz();
        bindQuiz();
      })
      .catch(function () {
        list.innerHTML =
          '<div class="quiz-error">No se pudo cargar <code>' +
          escapeHtml(QUIZ_URL) +
          "</code>. Si abriste el archivo con <code>file://</code>, sirve la carpeta con un servidor local, por ejemplo: <code>python3 -m http.server 8000</code>.</div>";
        var total = document.getElementById("score-total");
        if (total) total.textContent = "0";
      });
  }

  function bindQuiz() {
    var list = document.getElementById("quiz-list");
    var chips = document.querySelectorAll(".chip");
    var checkAll = document.getElementById("check-all");
    var reset = document.getElementById("reset-quiz");

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chips.forEach(function (c) {
          c.classList.toggle("is-active", c === chip);
        });
        state.filter = chip.getAttribute("data-filter");
        renderQuiz();
      });
    });

    if (checkAll) {
      checkAll.addEventListener("click", function () {
        visibleQuestions().forEach(function (q) {
          var answer = state.answers[q.id];
          if (answer && typeof answer.selected === "number" && !answer.checked) {
            checkQuestion(q);
          }
        });
        renderQuiz();
      });
    }

    if (reset) {
      reset.addEventListener("click", function () {
        state.answers = {};
        renderQuiz();
        var first = document.getElementById("quiz");
        if (first) first.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    list.addEventListener("change", function (event) {
      var input = event.target;
      if (!input || input.name !== "option") return;
      var card = input.closest(".quiz-card");
      if (!card) return;
      var id = card.getAttribute("data-id");
      var current = state.answers[id];
      if (current && current.checked) return;
      state.answers[id] = { selected: Number(input.value), checked: false };
      renderQuiz();
    });

    list.addEventListener("click", function (event) {
      var checkBtn = event.target.closest("[data-action='check']");
      var revealBtn = event.target.closest("[data-action='reveal']");
      var resetBtn = event.target.closest("[data-action='reset']");

      if (checkBtn) {
        var card = checkBtn.closest(".quiz-card");
        var question = findQuestion(card);
        if (!question) return;
        var answer = state.answers[question.id];
        if (typeof (answer && answer.selected) !== "number") {
          var feedback = card.querySelector(".feedback");
          if (feedback) {
            feedback.hidden = false;
            feedback.className = "feedback feedback--ko";
            feedback.textContent = "Selecciona una respuesta antes de comprobar.";
          }
          return;
        }
        checkQuestion(question);
        renderQuiz();
        return;
      }

      if (revealBtn) {
        var cardR = revealBtn.closest(".quiz-card");
        var explanation = cardR.querySelector(".explanation");
        var open = !explanation.hidden;
        explanation.hidden = open;
        revealBtn.textContent = open ? "Ver explicación" : "Ocultar explicación";
        revealBtn.setAttribute("aria-expanded", String(!open));
        return;
      }

      if (resetBtn) {
        var cardQ = resetBtn.closest(".quiz-card");
        delete state.answers[cardQ.getAttribute("data-id")];
        renderQuiz();
      }
    });
  }

  function findQuestion(card) {
    if (!card) return null;
    var id = card.getAttribute("data-id");
    for (var i = 0; i < state.questions.length; i++) {
      if (String(state.questions[i].id) === id) return state.questions[i];
    }
    return null;
  }

  function checkQuestion(question) {
    var answer = state.answers[question.id];
    if (!answer) return;
    answer.checked = true;
    answer.correct = answer.selected === question.correctAnswer;
  }

  function visibleQuestions() {
    return state.questions.filter(function (q) {
      return state.filter === "all" || String(q.domain) === String(state.filter);
    });
  }

  function renderQuiz() {
    var list = document.getElementById("quiz-list");
    if (!list) return;
    var visible = visibleQuestions();

    if (!visible.length) {
      list.innerHTML = '<div class="quiz-empty">Este dominio no tiene preguntas cargadas.</div>';
      updateScore();
      return;
    }

    list.innerHTML = visible.map(cardTemplate).join("");
    updateScore();
  }

  function cardTemplate(question) {
    var answer = state.answers[question.id] || {};
    var selected = typeof answer.selected === "number" ? answer.selected : -1;
    var checked = !!answer.checked;
    var letters = ["A", "B", "C", "D"];
    var domain = Number(question.domain);

    var options = question.options
      .map(function (text, index) {
        var classes = ["option"];
        if (selected === index) classes.push("is-selected");
        if (checked) {
          classes.push("is-locked");
          if (index === question.correctAnswer) classes.push("is-answer");
          if (index === selected && !answer.correct) classes.push("is-bad");
        }
        return (
          '<li class="' +
          classes.join(" ") +
          '">' +
          '<label>' +
          '<input type="radio" name="option" value="' +
          index +
          '"' +
          (selected === index ? " checked" : "") +
          (checked ? " disabled" : "") +
          ">" +
          '<span class="option__letter">' +
          letters[index] +
          '.</span>' +
          '<span class="option__text">' +
          escapeHtml(text) +
          "</span>" +
          "</label>" +
          "</li>"
        );
      })
      .join("");

    var feedback = "";
    if (checked) {
      if (answer.correct) {
        feedback =
          '<p class="feedback feedback--ok" role="status">¡Correcto! Excelente respuesta.</p>';
      } else {
        feedback =
          '<p class="feedback feedback--ko" role="status">Incorrecto. La respuesta correcta es la opción ' +
          letters[question.correctAnswer] +
          ".</p>";
      }
    } else {
      feedback = '<p class="feedback" role="status" hidden></p>';
    }

    var actions = checked
      ? '<button class="btn btn--ghost" type="button" data-action="reveal" aria-expanded="false">Ver explicación</button>' +
        '<button class="btn btn--ghost" type="button" data-action="reset">Reintentar</button>'
      : '<button class="btn btn--primary" type="button" data-action="check">Comprobar</button>' +
        '<button class="btn btn--ghost" type="button" data-action="reveal" aria-expanded="false">Ver explicación</button>';

    return (
      '<article class="quiz-card' +
      (checked ? (answer.correct ? " is-correct" : " is-wrong") : "") +
      '" data-id="' +
      escapeHtml(String(question.id)) +
      '">' +
      '<div class="quiz-card__head">' +
      '<span class="badge">Dominio ' +
      domain +
      "</span>" +
      '<span class="quiz-card__num">' +
      escapeHtml(DOMAIN_NAMES[domain] || "SC-500") +
      " · Pregunta " +
      escapeHtml(String(question.id)) +
      "</span>" +
      "</div>" +
      '<p class="quiz-card__question">' +
      escapeHtml(question.question) +
      "</p>" +
      '<ul class="options">' +
      options +
      "</ul>" +
      '<div class="quiz-card__actions">' +
      actions +
      "</div>" +
      feedback +
      '<div class="explanation" hidden><strong>Explicación:</strong> ' +
      escapeHtml(question.explanation) +
      "</div>" +
      "</article>"
    );
  }

  function updateScore() {
    var correct = 0;
    Object.keys(state.answers).forEach(function (id) {
      if (state.answers[id] && state.answers[id].correct) correct++;
    });
    var total = state.questions.length;
    var correctEl = document.getElementById("score-correct");
    var totalEl = document.getElementById("score-total");
    var bar = document.getElementById("progress-bar");
    if (correctEl) correctEl.textContent = String(correct);
    if (totalEl) totalEl.textContent = String(total);
    if (bar) bar.style.width = total ? (correct / total) * 100 + "%" : "0%";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
