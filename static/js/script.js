/* script.js — Folio: live search, star picker, review submission
   Uses jQuery for DOM manipulation and AJAX; vanilla JS for small helpers.
   ─────────────────────────────────────────────────────────────────────── */

"use strict";

// ── Helpers ──────────────────────────────────────────────────────────────────
function starsHtml(avg, total = 5) {
  let h = "";
  for (let i = 1; i <= total; i++)
    h += `<span class="star${i <= Math.round(avg) ? "" : " off"}">★</span>`;
  return h;
}

function escHtml(s) {
  return $("<div>").text(s).html(); // jQuery-safe escaping
}

// ── Image fallback ───────────────────────────────────────────────────────────
function attachImgFallbacks() {
  $("img.book-img").on("error", function () {
    const $ph = $(this).closest(".book-cover").find(".book-cover-placeholder");
    if ($ph.length) {
      $(this).hide();
      $ph.show();
    } else {
      $(this).hide();
    }
  });
}

// ── Stagger card animation ────────────────────────────────────────────────────
function staggerCards() {
  $(".book-card").each(function (i) {
    const $card = $(this);
    $card.css({ opacity: 0, transform: "translateY(16px)" });
    setTimeout(() => {
      $card.css({
        transition: "opacity .4s ease, transform .4s ease",
        opacity: 1,
        transform: "translateY(0)",
      });
    }, 30 + i * 32);
  });
}

// ════════════════════════ LIVE SEARCH (jQuery AJAX) ═══════════════════════════
function initLiveSearch() {
  const $input    = $(".search-form input[name='q']").first();
  const $dropdown = $("#searchDropdown");
  const $clearBtn = $(".search-clear").first();
  if (!$input.length || !$dropdown.length) return;

  let debounce = null;

  function showDropdown(html) {
    $dropdown.html(html).addClass("active");
  }

  function hideDropdown() {
    $dropdown.removeClass("active");
  }

  function doSearch(q) {
    if (!q || q.length < 2) { hideDropdown(); return; }
    showDropdown('<div class="dropdown-loading"><i class="bi bi-hourglass-split me-1"></i>Searching…</div>');

    $.getJSON("/api/search", { q })
      .done(function (data) {
        if (!data.length) {
          showDropdown('<div class="dropdown-empty">No books found</div>');
          return;
        }
        const items = data.slice(0, 8).map(function (b) {
          const stars =
            b.stats && b.stats.avg > 0
              ? `<span class="dropdown-stars">${"★".repeat(Math.round(b.stats.avg))}${"☆".repeat(5 - Math.round(b.stats.avg))}</span>`
              : "";
          const thumb = b.image
            ? `<img class="dropdown-thumb" src="${b.image}" onerror="this.style.display='none'" alt="" />`
            : `<div class="dropdown-thumb-ph">📖</div>`;
          return `<a class="dropdown-item" href="/book/${b.isbn}" role="option">
            ${thumb}
            <div class="dropdown-info">
              <div class="dropdown-title">${escHtml(b.title)}</div>
              <div class="dropdown-author">${escHtml(b.author)}${b.year ? " · " + b.year : ""}</div>
            </div>
            ${stars}
          </a>`;
        });
        showDropdown(items.join(""));
      })
      .fail(function () { hideDropdown(); });
  }

  // ── Input events ────────────────────────────────────────────────────────
  $input.on("input", function () {
    clearTimeout(debounce);
    const q = $(this).val().trim();
    if (!q) { hideDropdown(); return; }
    debounce = setTimeout(() => doSearch(q), 280);
  });

  $input.on("focus", function () {
    const q = $(this).val().trim();
    if (q.length >= 2) doSearch(q);
  });

  $(document).on("click", function (e) {
    if (!$(e.target).closest(".search-wrap").length) hideDropdown();
  });

  $input.on("keydown", function (e) {
    if (e.key === "Escape") { hideDropdown(); $(this).blur(); }
    if (e.key === "Enter") { hideDropdown(); $(this).closest("form").submit(); }
  });

  // ── Clear button ─────────────────────────────────────────────────────────
  $clearBtn.on("click", function () {
    $input.val("").trigger("focus");
    hideDropdown();
  });
}

// ════════════════════════ STAR PICKER ════════════════════════════════════════
function initStarPicker() {
  const $picker = $(".star-picker");
  if (!$picker.length) return;

  const $stars  = $picker.find(".sp-star");
  const $label  = $("#starLabel");
  const $input  = $("#starValue");
  const labels  = ["", "Terrible", "Poor", "OK", "Good", "Excellent"];
  let selected  = 0;

  function illuminate(n) {
    $stars.each(function (i) {
      $(this)
        .toggleClass("lit", i < n)
        .text(i < n ? "★" : "☆");
    });
    $label.text(n > 0 ? labels[n] : "Select rating");
  }

  $stars
    .on("mouseenter", function () { illuminate(parseInt($(this).data("val"))); })
    .on("mouseleave", function () { illuminate(selected); })
    .on("click keydown", function (e) {
      if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
      selected = parseInt($(this).data("val"));
      $input.val(selected);
      illuminate(selected);
      // Clear star validation error
      $("#starsError").hide();
      $(this).closest(".form-row").find("input[type=hidden]").removeClass("is-invalid");
    });
}

// ════════════════════════ CHARACTER COUNTER ═══════════════════════════════════
function initCharCounter() {
  const $ta    = $("#reviewComment");
  const $count = $("#commentCount");
  if (!$ta.length) return;
  $ta.on("input", function () {
    const len = $(this).val().length;
    $count.text(`${len} / 2000`);
    $count.toggleClass("text-danger", len > 1900);
  });
}

// ════════════════════════ FORM VALIDATION ════════════════════════════════════
function validateReviewForm(name, stars, comment) {
  let valid = true;

  // Name — optional, but if provided must be ≤ 80 chars
  if (name.length > 80) {
    $("#nameError").text("Name must be 80 characters or fewer.").show();
    $("#reviewerName").addClass("is-invalid");
    valid = false;
  } else {
    $("#nameError").hide();
    $("#reviewerName").removeClass("is-invalid").addClass("is-valid");
  }

  // Stars — required
  if (!stars || stars < 1 || stars > 5) {
    $("#starsError").text("Please select a star rating.").show();
    valid = false;
  } else {
    $("#starsError").hide();
  }

  // Comment — required, min 5 chars
  const commentVal = comment.trim();
  if (commentVal.length < 5) {
    const msg = commentVal.length === 0
      ? "A review comment is required."
      : "Comment must be at least 5 characters.";
    $("#commentError").text(msg).show();
    $("#reviewComment").addClass("is-invalid");
    valid = false;
  } else if (commentVal.length > 2000) {
    $("#commentError").text("Comment must be 2000 characters or fewer.").show();
    $("#reviewComment").addClass("is-invalid");
    valid = false;
  } else {
    $("#commentError").hide();
    $("#reviewComment").removeClass("is-invalid").addClass("is-valid");
  }

  return valid;
}

// ════════════════════════ SUBMIT REVIEW (jQuery AJAX) ════════════════════════
function initReviewForm() {
  const $form = $("#reviewForm");
  if (!$form.length) return;

  $form.on("submit", function (e) {
    e.preventDefault();

    const isbn    = $form.data("isbn");
    const name    = $("#reviewerName").val().trim();
    const stars   = parseInt($("#starValue").val(), 10);
    const comment = $("#reviewComment").val().trim();
    const $btn    = $form.find(".submit-review-btn");

    // Client-side validation
    if (!validateReviewForm(name, stars, comment)) return;

    // Disable button, show loading
    $btn.prop("disabled", true).html('<i class="bi bi-hourglass-split me-1"></i>Posting…');
    $("#reviewError").hide();
    $("#reviewSuccess").removeClass("show");

    $.ajax({
      url:         "/api/review",
      type:        "POST",
      contentType: "application/json",
      data:        JSON.stringify({ isbn, name: name || "Anonymous", stars, comment }),
    })
      .done(function (data) {
        if (data.ok) {
          prependReview(data.review);
          updateRatingSummary(data.stats);

          // Success message
          $("#reviewSuccess").addClass("show");
          setTimeout(() => $("#reviewSuccess").removeClass("show"), 4000);

          // Reset form
          $("#reviewerName").val("").removeClass("is-valid is-invalid");
          $("#reviewComment").val("").removeClass("is-valid is-invalid");
          $("#starValue").val("0");
          $("#commentCount").text("0 / 2000");
          $form.find(".sp-star").removeClass("lit").text("☆");
          $("#starLabel").text("Select rating");
        }
      })
      .fail(function (xhr) {
        const resp = xhr.responseJSON;
        const msg  = resp && resp.errors ? resp.errors.join(" ") : "Something went wrong. Please try again.";
        $("#reviewError").text(msg).show();
      })
      .always(function () {
        $btn.prop("disabled", false).html('<i class="bi bi-send me-1"></i>Post Review');
      });
  });
}

// ── DOM helpers ──────────────────────────────────────────────────────────────
function prependReview(r) {
  const $list = $("#reviewsList");
  if (!$list.length) return;

  // Remove placeholder
  $list.find("#noReviewsPlaceholder").remove();

  const starsMarkup = Array.from({ length: 5 }, (_, i) =>
    `<span class="star${i < r.stars ? "" : " off"}">★</span>`
  ).join("");

  const $card = $(`
    <article class="review-card" style="animation:fadeUp .4s ease both">
      <div class="review-header">
        <div>
          <p class="reviewer-name">${escHtml(r.name)}</p>
          <div class="review-stars" aria-label="${r.stars} out of 5">${starsMarkup}</div>
        </div>
        <time class="review-date">${escHtml(r.created)}</time>
      </div>
      <p class="review-text">${escHtml(r.comment)}</p>
    </article>
  `);

  $list.prepend($card);
}

function updateRatingSummary(stats) {
  $("#avgScore").text(stats.avg > 0 ? stats.avg.toFixed(1) : "—");
  $("#reviewCount").text(`${stats.count} review${stats.count === 1 ? "" : "s"}`);
  $("#summaryStars").html(starsHtml(stats.avg));
}

// ════════════════════════ SCROLL TO RESULTS ═══════════════════════════════════
function scrollToResults() {
  const $el = $("#results");
  if ($el.length) {
    setTimeout(() => $("html, body").animate({ scrollTop: $el.offset().top - 80 }, 400), 150);
  }
}

// ════════════════════════ BOOTSTRAP TOOLTIPS ═════════════════════════════════
function initTooltips() {
  $('[data-bs-toggle="tooltip"]').each(function () {
    new bootstrap.Tooltip(this);
  });
}

// ═══════════════════════════ INIT (jQuery ready) ══════════════════════════════
$(function () {
  attachImgFallbacks();
  staggerCards();
  initLiveSearch();
  initStarPicker();
  initCharCounter();
  initReviewForm();
  scrollToResults();
  initTooltips();
});
