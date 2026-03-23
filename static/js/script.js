/* script.js — Folio: live search, star picker, review form (jQuery) */
"use strict";

// ── Escape HTML safely ────────────────────────────────────────────────────────
function esc(s) { return $("<div>").text(s).html(); }

// ── Star string helper ────────────────────────────────────────────────────────
function starsHtml(avg) {
  const n = Math.round(avg);
  return "★".repeat(n) + "☆".repeat(5 - n);
}

// ── Stagger card fade-in ──────────────────────────────────────────────────────
function staggerCards() {
  $(".book-card").each(function (i) {
    $(this).css({ opacity: 0 });
    setTimeout(() => $(this).css({ transition: "opacity .4s", opacity: 1 }), i * 40);
  });
}

// ════════════════════════ LIVE SEARCH ════════════════════════════════════════
function initLiveSearch() {
  const $input    = $("#searchInput");
  const $dropdown = $("#searchDropdown");
  if (!$input.length || !$dropdown.length) return;

  let timer;

  function show(html) { $dropdown.html(html).addClass("active"); }
  function hide()      { $dropdown.removeClass("active"); }

  function search(q) {
    if (q.length < 2) { hide(); return; }
    show('<div class="dropdown-loading">Searching…</div>');
    $.getJSON("/api/search", { q })
      .done(function (data) {
        if (!data.length) { show('<div class="dropdown-empty">No books found</div>'); return; }
        const html = data.slice(0, 8).map(b => `
          <a class="dropdown-item" href="/book/${b.isbn}">
            ${b.image ? `<img class="dropdown-thumb" src="${b.image}" onerror="this.style.display='none'" alt="" />` : '<div class="dropdown-thumb" style="background:#2a4a38;display:flex;align-items:center;justify-content:center;">📖</div>'}
            <div>
              <div class="dropdown-title">${esc(b.title)}</div>
              <div class="dropdown-author">${esc(b.author)}${b.year ? " · " + b.year : ""}</div>
            </div>
          </a>`).join("");
        show(html);
      })
      .fail(hide);
  }

  $input.on("input", function () {
    clearTimeout(timer);
    const q = $(this).val().trim();
    if (!q) { hide(); return; }
    timer = setTimeout(() => search(q), 280);
  });

  $input.on("focus", function () {
    const q = $(this).val().trim();
    if (q.length >= 2) search(q);
  });

  $(document).on("click", function (e) {
    if (!$(e.target).closest(".search-wrap").length) hide();
  });

  $input.on("keydown", function (e) {
    if (e.key === "Escape") { hide(); $(this).blur(); }
  });
}

// ════════════════════════ STAR PICKER ════════════════════════════════════════
function initStarPicker() {
  const $stars  = $(".sp-star");
  const $input  = $("#starValue");
  const $label  = $("#starLabel");
  const labels  = ["", "Terrible", "Poor", "OK", "Good", "Excellent"];
  let selected  = 0;

  if (!$stars.length) return;

  function light(n) {
    $stars.each(function (i) {
      $(this).toggleClass("lit", i < n).text(i < n ? "★" : "☆");
    });
    $label.text(n ? labels[n] : "Select rating");
  }

  $stars
    .on("mouseenter", function () { light(+$(this).data("val")); })
    .on("mouseleave", function () { light(selected); })
    .on("click", function () {
      selected = +$(this).data("val");
      $input.val(selected);
      light(selected);
      $("#starsError").hide();
    });
}

// ════════════════════════ CHARACTER COUNTER ═══════════════════════════════════
function initCharCounter() {
  $("#reviewComment").on("input", function () {
    const n = $(this).val().length;
    $("#commentCount").text(n + " / 2000").toggleClass("text-danger", n > 1900);
  });
}

// ════════════════════════ FORM VALIDATION ════════════════════════════════════
function validateForm(name, stars, comment) {
  let ok = true;

  if (name.length > 80) {
    $("#nameError").text("Name must be 80 chars or fewer.").show();
    $("#reviewerName").addClass("is-invalid");
    ok = false;
  } else {
    $("#nameError").hide();
    $("#reviewerName").removeClass("is-invalid");
  }

  if (stars < 1 || stars > 5) {
    $("#starsError").text("Please select a star rating.").show();
    ok = false;
  } else {
    $("#starsError").hide();
  }

  if (comment.length < 5) {
    $("#commentError").text(comment.length === 0 ? "Review is required." : "Min 5 characters.").show();
    $("#reviewComment").addClass("is-invalid");
    ok = false;
  } else if (comment.length > 2000) {
    $("#commentError").text("Max 2000 characters.").show();
    $("#reviewComment").addClass("is-invalid");
    ok = false;
  } else {
    $("#commentError").hide();
    $("#reviewComment").removeClass("is-invalid");
  }

  return ok;
}

// ════════════════════════ REVIEW FORM ════════════════════════════════════════
function initReviewForm() {
  const $form = $("#reviewForm");
  if (!$form.length) return;

  $form.on("submit", function (e) {
    e.preventDefault();

    const isbn    = $form.data("isbn");
    const name    = $("#reviewerName").val().trim();
    const stars   = +$("#starValue").val();
    const comment = $("#reviewComment").val().trim();
    const $btn    = $form.find("button[type=submit]");

    if (!validateForm(name, stars, comment)) return;

    $btn.prop("disabled", true).html('<i class="bi bi-hourglass-split me-1"></i>Posting…');
    $("#reviewError").hide();
    $("#reviewSuccess").addClass("d-none");

    $.ajax({
      url: "/api/review", type: "POST",
      contentType: "application/json",
      data: JSON.stringify({ isbn, name: name || "Anonymous", stars, comment })
    })
    .done(function (data) {
      if (!data.ok) return;

      // Prepend new review card
      $("#noReviewsPlaceholder").remove();
      const stars_html = "★".repeat(data.review.stars) + "☆".repeat(5 - data.review.stars);
      $("#reviewsList").prepend(`
        <div class="card mb-3 shadow-sm" style="animation:fadeIn .4s ease">
          <div class="card-body">
            <div class="d-flex justify-content-between flex-wrap gap-1">
              <div><strong>${esc(data.review.name)}</strong>
                <span class="text-warning ms-2">${stars_html}</span></div>
              <small class="text-muted">${esc(data.review.created)}</small>
            </div>
            <p class="mt-2 mb-0">${esc(data.review.comment)}</p>
          </div>
        </div>`);

      // Update rating summary
      const s = data.stats;
      $("#avgScore").text(s.avg > 0 ? s.avg.toFixed(1) : "—");
      $("#summaryStars").text(starsHtml(s.avg));
      $("#reviewCount").text(s.count + " review" + (s.count === 1 ? "" : "s"));

      // Show success, reset form
      $("#reviewSuccess").removeClass("d-none");
      setTimeout(() => $("#reviewSuccess").addClass("d-none"), 4000);
      $form[0].reset();
      $("#starValue").val("0");
      $(".sp-star").removeClass("lit").text("☆");
      $("#starLabel").text("Select rating");
      $("#commentCount").text("0 / 2000");
    })
    .fail(function (xhr) {
      const msg = xhr.responseJSON?.errors?.join(" ") || "Something went wrong. Try again.";
      $("#reviewError").text(msg).show();
    })
    .always(function () {
      $btn.prop("disabled", false).html('<i class="bi bi-send me-1"></i>Post Review');
    });
  });
}

// ════════════════════════ INIT ════════════════════════════════════════════════
$(function () {
  staggerCards();
  initLiveSearch();
  initStarPicker();
  initCharCounter();
  initReviewForm();
});