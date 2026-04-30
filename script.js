/* MIDTS form and interaction logic.
   Connect this file to Make.com, Airtable, Brevo, and analytics later.
*/

// STEP 1: Replace this with your Make.com webhook URL for initial lead capture.
const STEP_1_WEBHOOK_URL = "https://hook.make.com/YOUR_STEP_1_WEBHOOK_URL";

// STEP 2: Replace this with your Make.com webhook URL for technical intake.
// You can also use the same webhook and route by "form_stage".
const STEP_2_WEBHOOK_URL = "https://hook.make.com/YOUR_STEP_2_WEBHOOK_URL";

// If testing before your webhook is ready, keep this as true.
// Set to false when your Make.com webhook is connected.
const DEMO_MODE = true;

const menuToggle = document.querySelector("[data-menu-toggle]");
const nav = document.querySelector("[data-nav]");
const header = document.querySelector("[data-header]");

if (menuToggle && nav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    document.body.classList.toggle("menu-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      document.body.classList.remove("menu-open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });
}

function updateHeaderState() {
  if (!header) return;

  if (window.scrollY > 12) {
    header.classList.add("scrolled");
  } else {
    header.classList.remove("scrolled");
  }
}

window.addEventListener("scroll", updateHeaderState, { passive: true });
updateHeaderState();


function resolveBrandLogos() {
  const logoNodes = document.querySelectorAll(".brand-logo");
  if (!logoNodes.length) return;

  const candidates = [
    "assets/midts-logo.png",
    "assets/midts-logo.webp",
    "assets/midts-logo.jpg",
    "assets/logo.png",
    "assets/logo.svg",
    "assets/midts-logo.svg"
  ];

  const probe = new Image();
  let index = 0;

  probe.onload = () => {
    logoNodes.forEach((img) => { img.src = candidates[index]; });
  };

  probe.onerror = () => {
    index += 1;
    if (index < candidates.length) {
      probe.src = candidates[index];
    }
  };

  probe.src = candidates[index];
}

resolveBrandLogos();

/* Scroll reveal animation */
const revealElements = document.querySelectorAll(".reveal");

if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Apply will-change just before the animation fires, not on page load
          entry.target.style.willChange = "opacity, transform";
          entry.target.classList.add("visible");
          revealObserver.unobserve(entry.target);
          // Clean up will-change once the transition completes
          entry.target.addEventListener("transitionend", function cleanup() {
            entry.target.style.willChange = "auto";
            entry.target.removeEventListener("transitionend", cleanup);
          });
        }
      });
    },
    {
      threshold: 0.14,
      rootMargin: "0px 0px -30px 0px"
    }
  );

  revealElements.forEach((element) => {
    revealObserver.observe(element);
  });
} else {
  revealElements.forEach((element) => element.classList.add("visible"));
}

const leadForm = document.getElementById("leadForm");
const technicalForm = document.getElementById("technicalForm");
const step1Message = document.querySelector("[data-message-step1]");
const step2Message = document.querySelector("[data-message-step2]");
const step1Button = document.querySelector("[data-submit-step1]");
const step2Button = document.querySelector("[data-submit-step2]");
const leadIdField = document.querySelector("[data-lead-id]");

function getUTMParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    utm_source: params.get("utm_source") || "",
    utm_medium: params.get("utm_medium") || "",
    utm_campaign: params.get("utm_campaign") || ""
  };
}

function nowISO() {
  return new Date().toISOString();
}

function clearInvalidState(form) {
  form.querySelectorAll(".invalid").forEach((field) => field.classList.remove("invalid"));
}

function validateForm(form) {
  clearInvalidState(form);

  const requiredFields = Array.from(form.querySelectorAll("[required]"));
  let isValid = true;

  requiredFields.forEach((field) => {
    const isCheckbox = field.type === "checkbox";
    const empty = isCheckbox ? !field.checked : !field.value.trim();

    if (empty) {
      field.classList.add("invalid");
      isValid = false;
    }

    if (field.type === "email" && field.value && !field.checkValidity()) {
      field.classList.add("invalid");
      isValid = false;
    }

    if (field.type === "url" && field.value && !field.checkValidity()) {
      field.classList.add("invalid");
      isValid = false;
    }
  });

  return isValid;
}

function formToObject(form) {
  const data = new FormData(form);
  const payload = {};

  data.forEach((value, key) => {
    payload[key] = typeof value === "string" ? value.trim() : value;
  });

  form.querySelectorAll("input[type='checkbox']").forEach((checkbox) => {
    payload[checkbox.name] = checkbox.checked;
  });

  return payload;
}

async function postJSON(url, payload) {
  if (DEMO_MODE) {
    console.info("DEMO MODE payload:", payload);
    await new Promise((resolve) => setTimeout(resolve, 700));
    return {
      ok: true,
      lead_id: payload.lead_id || `MIDTS-${Date.now()}`
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Webhook error: ${response.status}`);
  }

  // Make.com can return Airtable Record ID / Lead ID here.
  // Example expected response: { "lead_id": "recXXXXXXXXXXXX" }
  try {
    return await response.json();
  } catch {
    return { ok: true };
  }
}

function setMessage(element, text, type) {
  element.textContent = text;
  element.className = `form-message ${type || ""}`;
}

function showTechnicalStep(leadId) {
  const step1Pill = document.querySelector("[data-progress='1']");
  const step2Pill = document.querySelector("[data-progress='2']");

  if (step1Pill) {
    step1Pill.classList.remove("active");
    step1Pill.classList.add("completed");
  }
  if (step2Pill) {
    step2Pill.classList.add("active");
  }

  leadForm.classList.remove("active");
  technicalForm.classList.add("active");

  if (leadIdField) {
    leadIdField.value = leadId || "";
  }

  // Scroll to form-shell so the progress bar is visible on transition.
  const formShell = document.getElementById("form-shell");
  if (formShell) {
    formShell.scrollIntoView({ behavior: "smooth", block: "start" });
  } else {
    technicalForm.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

if (leadForm) {
  leadForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!validateForm(leadForm)) {
      setMessage(step1Message, "Please complete the required fields.", "error");
      return;
    }

    const formData = formToObject(leadForm);
    const utm = getUTMParams();

    const payload = {
      source: "MIDTS Website",
      form_stage: "step_1_initial_lead",
      lead_status: "New",
      full_name: formData.full_name || "",
      email: formData.email || "",
      company_name: formData.company_name || "",
      job_title: formData.job_title || "",
      company_website: formData.company_website || "",
      support_needed: formData.support_needed || "",
      urgency: formData.urgency || "",
      requirement_summary: formData.requirement_summary || "",
      consent: Boolean(formData.consent),
      submitted_at: nowISO(),
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      page_url: window.location.href
    };

    step1Button.disabled = true;
    step1Button.textContent = "Sending...";
    setMessage(step1Message, "", "");

    try {
      const result = await postJSON(STEP_1_WEBHOOK_URL, payload);

      // Airtable Lead ID logic:
      // In Make.com, create Airtable record first.
      // Return the Airtable record ID as { "lead_id": "rec..." }.
      const leadId = result.lead_id || `MIDTS-${Date.now()}`;

      setMessage(
        step1Message,
        "Thanks. We’ve received your initial requirement. Continue technical intake for quote review.",
        "success"
      );

      setTimeout(() => showTechnicalStep(leadId), 500);
    } catch (error) {
      console.error(error);
      setMessage(step1Message, "There was a problem sending the form. Please try again.", "error");
    } finally {
      step1Button.disabled = false;
      step1Button.textContent = "Send requirement for review";
    }
  });
}

if (technicalForm) {
  technicalForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!validateForm(technicalForm)) {
      setMessage(step2Message, "Please complete the required fields.", "error");
      return;
    }

    const formData = formToObject(technicalForm);

    const payload = {
      source: "MIDTS Website",
      form_stage: "step_2_technical_intake",
      lead_id: formData.lead_id || "",
      project_name: formData.project_name || "",
      required_output: formData.required_output || "",
      existing_files_available: formData.existing_files_available || "",
      material_or_process: formData.material_or_process || "",
      tolerance_requirements: formData.tolerance_requirements || "",
      deadline: formData.deadline || "",
      additional_notes: formData.additional_notes || "",
      submitted_at: nowISO(),
      page_url: window.location.href
    };

    step2Button.disabled = true;
    step2Button.textContent = "Sending...";
    setMessage(step2Message, "", "");

    try {
      await postJSON(STEP_2_WEBHOOK_URL, payload);

      // Brevo tracking later:
      // Trigger nurture or confirmation from Make.com after Airtable update.
      // Slack alert later:
      // Send internal alert when Step 2 completes.
      // Analytics later:
      // Push conversion event here.

      setMessage(
        step2Message,
        "Technical details received. MIDTS will review the scope and prepare the next step.",
        "success"
      );

      technicalForm.reset();
    } catch (error) {
      console.error(error);
      setMessage(step2Message, "There was a problem sending the technical intake. Please try again.", "error");
    } finally {
      step2Button.disabled = false;
      step2Button.textContent = "Submit technical details";
    }
  });
}

/* ═══════════════════════════════════════════════════════
   SCROLL SPY — highlights the active section in the nav.
   Airtable / Analytics: extend here if section-level
   tracking is needed (e.g. push events on section entry).
════════════════════════════════════════════════════════ */

(function () {
  const spySections = document.querySelectorAll("section[id]");
  const spyLinks = document.querySelectorAll(".site-nav a[href^='#']");

  if (!("IntersectionObserver" in window) || !spySections.length || !spyLinks.length) return;

  function clearActive() {
    spyLinks.forEach(function (link) {
      link.classList.remove("nav-active");
    });
  }

  const spyObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          clearActive();
          const active = document.querySelector(
            ".site-nav a[href='#" + entry.target.id + "']"
          );
          if (active) active.classList.add("nav-active");
        }
      });
    },
    {
      threshold: 0,
      rootMargin: "-10% 0px -65% 0px"
    }
  );

  spySections.forEach(function (section) {
    spyObserver.observe(section);
  });
})();

/* ═══════════════════════════════════════════════════════
   HERO ENTRANCE — staggered on DOMContentLoaded.
   Each .hero-animate element enters 130ms after the last.
   Analytics: extend here to track hero impression if needed.
════════════════════════════════════════════════════════ */

(function () {
  const heroElements = document.querySelectorAll(".hero-animate");
  if (!heroElements.length) return;

  heroElements.forEach(function (el, i) {
    el.style.transitionDelay = (i * 130) + "ms";
  });

  // Trigger on next frame so CSS transition fires correctly
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      heroElements.forEach(function (el) {
        el.classList.add("hero-visible");
      });
      // Clean up transition delays once entrance is complete
      var last = heroElements[heroElements.length - 1];
      last.addEventListener("transitionend", function cleanup() {
        heroElements.forEach(function (el) {
          el.style.transitionDelay = "";
        });
        last.removeEventListener("transitionend", cleanup);
      });
    });
  });
})();

/* ═══════════════════════════════════════════════════════
   FAQ ANIMATION — smooth height transition on open/close.
   Native <details> snaps without this.
════════════════════════════════════════════════════════ */

(function () {
  var faqItems = document.querySelectorAll(".faq-item");
  if (!faqItems.length) return;

  faqItems.forEach(function (item) {
    var summary = item.querySelector("summary");
    var answer = item.querySelector(".faq-answer");
    if (!summary || !answer) return;

    summary.addEventListener("click", function (e) {
      e.preventDefault();

      if (item.open) {
        // Closing
        answer.style.height = answer.scrollHeight + "px";
        answer.style.overflow = "hidden";
        requestAnimationFrame(function () {
          answer.style.height = "0";
        });
        answer.addEventListener("transitionend", function done() {
          item.removeAttribute("open");
          answer.style.height = "";
          answer.style.overflow = "";
          answer.removeEventListener("transitionend", done);
        });
      } else {
        // Opening
        item.setAttribute("open", "");
        var target = answer.scrollHeight;
        answer.style.height = "0";
        answer.style.overflow = "hidden";
        requestAnimationFrame(function () {
          answer.style.height = target + "px";
        });
        answer.addEventListener("transitionend", function done() {
          answer.style.height = "";
          answer.style.overflow = "";
          answer.removeEventListener("transitionend", done);
        });
      }
    });
  });
})();
