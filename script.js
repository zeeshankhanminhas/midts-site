/* MIDTS form and interaction logic.
   Connect this file to Make.com, Airtable, Brevo, and analytics later.
*/

// STEP 1: Replace this with your Make.com webhook URL for initial lead capture.
const STEP_1_WEBHOOK_URL = "https://hook.make.com/YOUR_STEP_1_WEBHOOK_URL";

// STEP 2: Replace this with your Make.com webhook URL for technical intake.
// You can also use the same webhook and route by "form_stage".
const STEP_2_WEBHOOK_URL = "https://hook.make.com/YOUR_STEP_2_WEBHOOK_URL";

// If testing locally before your webhook is ready, set this to true.
// It will simulate a successful submission and generate a temporary Lead ID.
const DEMO_MODE = true;

const menuToggle = document.querySelector("[data-menu-toggle]");
const nav = document.querySelector("[data-nav]");

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
  document.querySelector("[data-progress='1']").classList.remove("active");
  document.querySelector("[data-progress='2']").classList.add("active");

  leadForm.classList.remove("active");
  technicalForm.classList.add("active");

  if (leadIdField) {
    leadIdField.value = leadId || "";
  }

  technicalForm.scrollIntoView({ behavior: "smooth", block: "start" });
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
      step1Button.textContent = "Send requirement";
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
      step2Button.textContent = "Complete technical details";
    }
  });
}
