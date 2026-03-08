const FONT_SIZE_STORAGE_KEY = "cv-font-size-v2";
const DEFAULT_FONT_SIZE = 17;
const MIN_FONT_SIZE = 15;
const MAX_FONT_SIZE = 21;
const FONT_SIZE_STEP = 1;

let publicationHighlightTimer;
const EMPLOYMENT_COLLAPSE_BREAKPOINT = 980;

function createElement(tagName, className, html) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  if (html !== undefined) {
    element.innerHTML = html;
  }
  return element;
}

function renderSkills(skills) {
  const list = document.getElementById("skills-list");
  list.innerHTML = skills.map((skill) => `<li>${skill}</li>`).join("");
}

function renderEducation(items) {
  const list = document.getElementById("education-list");
  list.innerHTML = "";

  items.forEach((item) => {
    const listItem = createElement(
      "li",
      "education-item",
      `
        <article class="education-card">
          <p class="timeline-meta">${item.institution}</p>
          <h3>${item.degree}</h3>
          <p class="education-duration">${item.duration}</p>
        </article>
      `
    );
    list.appendChild(listItem);
  });
}

function renderExperience(items) {
  const list = document.getElementById("experience-list");
  list.innerHTML = "";

  items.forEach((item) => {
    const status = item.status
      ? `<p class="experience-status">${item.status}</p>`
      : "";

    const card = createElement(
      "article",
      "experience-entry",
      `
        <p class="experience-meta">${item.institution}</p>
        <h3>${item.role}</h3>
        <p class="experience-duration">${item.duration}</p>
        ${status}
      `
    );
    list.appendChild(card);
  });
}

function renderPublicationChart(publicationYears) {
  const chart = document.getElementById("publication-chart");
  const years = Object.keys(publicationYears).sort((a, b) => Number(a) - Number(b));
  const maxCount = Math.max(...Object.values(publicationYears));
  const maxBarHeight = 220;

  chart.innerHTML = years
    .map((year) => {
      const count = publicationYears[year];
      const height = Math.max((count / maxCount) * maxBarHeight, 12);

      return `
        <button
          class="publication-bar-group"
          type="button"
          data-publication-year="${year}"
          aria-label="${count} peer-reviewed publications in ${year}"
        >
          <span class="publication-bar-count">${count}</span>
          <div class="publication-bar-track">
            <div class="publication-bar" style="height: ${height}px;"></div>
          </div>
          <span class="publication-bar-year">${year}</span>
        </button>
      `;
    })
    .join("");
}

function publicationCard(publication) {
  const types = (publication.publication_types || []).slice(0, 2);
  const chips = types.map((type) => `<span class="meta-chip">${type}</span>`).join("");
  const doiLink = publication.doi
    ? `<a href="https://doi.org/${publication.doi}" target="_blank" rel="noreferrer">DOI</a>`
    : "";

  return `
    <article class="citation-card" data-publication-year="${publication.year}">
      <div class="citation-meta">
        <p class="timeline-meta">${publication.publication_date}</p>
        <p class="citation-journal">${publication.journal}</p>
        ${chips}
      </div>
      <h3 class="citation-title">${publication.title}</h3>
      <p class="citation-authors">${publication.authors_display}</p>
      <div class="citation-links">
        <a href="${publication.pubmed_url}" target="_blank" rel="noreferrer">PubMed</a>
        ${doiLink}
      </div>
    </article>
  `;
}

function renderPublications(data) {
  renderPublicationChart(data.publication_years);
  document.getElementById("publication-list").innerHTML = data.publications
    .map(publicationCard)
    .join("");
}

function renderContributions(data) {
  document.getElementById("contribution-list").innerHTML = data.other_contributions
    .map(
      (item) => `
        <article class="contribution-card">
          <div class="contribution-meta">
            <p class="timeline-meta">${item.date}</p>
            <p class="meta-chip">${item.type}</p>
            <p class="contribution-venue">${item.venue}</p>
          </div>
          <h3 class="contribution-title">${item.title}</h3>
          <p class="contribution-credit">${item.credit}</p>
          <p class="contribution-description">${item.description}</p>
          <div class="contribution-links">
            <a href="${item.url}" target="_blank" rel="noreferrer">View record</a>
          </div>
        </article>
      `
    )
    .join("");
}

function setSectionState(section, expanded) {
  const button = section.querySelector(".section-toggle");
  const body = section.querySelector(".section-body");
  const icon = section.querySelector(".section-toggle-icon");

  section.classList.toggle("is-open", expanded);
  button.setAttribute("aria-expanded", String(expanded));
  body.classList.toggle("is-collapsed", !expanded);
  icon.textContent = expanded ? "−" : "+";
}

function setEmploymentState(expanded) {
  const button = document.querySelector(".experience-toggle");
  const body = document.getElementById("employment-body");
  const icon = document.querySelector(".experience-toggle-icon");

  if (!button || !body || !icon) {
    return;
  }

  button.setAttribute("aria-expanded", String(expanded));
  body.classList.toggle("is-collapsed", !expanded);
  icon.textContent = expanded ? "−" : "+";
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return DEFAULT_FONT_SIZE;
  }

  return Math.min(Math.max(value, min), max);
}

function readStoredFontSize() {
  try {
    const value = window.localStorage.getItem(FONT_SIZE_STORAGE_KEY);
    return value ? Number(value) : DEFAULT_FONT_SIZE;
  } catch {
    return DEFAULT_FONT_SIZE;
  }
}

function writeStoredFontSize(size) {
  try {
    window.localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(size));
  } catch {
    // Ignore storage failures and keep the in-memory font size.
  }
}

function updateTextControlState(size) {
  document.querySelectorAll("[data-size-action]").forEach((button) => {
    const action = button.getAttribute("data-size-action");
    button.disabled =
      (action === "decrease" && size <= MIN_FONT_SIZE) ||
      (action === "increase" && size >= MAX_FONT_SIZE);
  });
}

function applyFontSize(size) {
  const nextSize = clamp(size, MIN_FONT_SIZE, MAX_FONT_SIZE);
  document.documentElement.style.setProperty("--base-font-size", `${nextSize}px`);
  updateTextControlState(nextSize);
  return nextSize;
}

function wireTextControls() {
  const controls = [...document.querySelectorAll("[data-size-action]")];

  if (!controls.length) {
    return;
  }

  let currentSize = applyFontSize(readStoredFontSize());

  controls.forEach((button) => {
    button.addEventListener("click", () => {
      const delta = button.getAttribute("data-size-action") === "increase"
        ? FONT_SIZE_STEP
        : -FONT_SIZE_STEP;

      currentSize = applyFontSize(currentSize + delta);
      writeStoredFontSize(currentSize);
    });
  });
}

function clearPublicationHighlights() {
  document.querySelectorAll(".citation-card.is-targeted").forEach((card) => {
    card.classList.remove("is-targeted");
  });
}

function wirePublicationChart() {
  const bars = [...document.querySelectorAll(".publication-bar-group[data-publication-year]")];

  if (!bars.length) {
    return;
  }

  bars.forEach((button) => {
    button.addEventListener("click", () => {
      const year = button.getAttribute("data-publication-year");
      const matches = [...document.querySelectorAll(`.citation-card[data-publication-year="${year}"]`)];

      if (!matches.length) {
        return;
      }

      clearPublicationHighlights();
      matches.forEach((card) => card.classList.add("is-targeted"));

      window.clearTimeout(publicationHighlightTimer);
      publicationHighlightTimer = window.setTimeout(clearPublicationHighlights, 2200);

      matches[0].scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    });
  });
}

function wireAccordions() {
  const sections = [...document.querySelectorAll(".section")];

  sections.forEach((section) => {
    setSectionState(section, section.id === "overview");

    const button = section.querySelector(".section-toggle");
    button.addEventListener("click", () => {
      const expanded = button.getAttribute("aria-expanded") === "true";
      setSectionState(section, !expanded);
    });
  });

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", () => {
      const href = link.getAttribute("href");
      if (!href || href === "#top") {
        return;
      }

      const target = document.querySelector(href);
      if (target && target.classList.contains("section")) {
        setSectionState(target, true);
      }
    });
  });

  if (window.location.hash) {
    const target = document.querySelector(window.location.hash);
    if (target && target.classList.contains("section")) {
      setSectionState(target, true);
    }
  }
}

function wireScrollSpy() {
  const sections = [...document.querySelectorAll(".section[id]")];
  const links = [...document.querySelectorAll(".toc-link")];

  if (!sections.length || !links.length) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!visible) {
        return;
      }

      links.forEach((link) => {
        link.classList.toggle(
          "is-active",
          link.getAttribute("href") === `#${visible.target.id}`
        );
      });
    },
    {
      rootMargin: "-20% 0px -65% 0px",
      threshold: [0.1, 0.25, 0.5]
    }
  );

  sections.forEach((section) => observer.observe(section));
}

function wireEmploymentPanel() {
  const button = document.querySelector(".experience-toggle");

  if (!button) {
    return;
  }

  const compactQuery = window.matchMedia(`(max-width: ${EMPLOYMENT_COLLAPSE_BREAKPOINT}px)`);
  let hasInitialized = false;

  const syncEmploymentState = (matches) => {
    if (!hasInitialized) {
      setEmploymentState(!matches);
      hasInitialized = true;
      return;
    }

    if (matches) {
      setEmploymentState(false);
    } else {
      setEmploymentState(true);
    }
  };

  syncEmploymentState(compactQuery.matches);

  button.addEventListener("click", () => {
    const expanded = button.getAttribute("aria-expanded") === "true";
    setEmploymentState(!expanded);
  });

  compactQuery.addEventListener("change", (event) => {
    syncEmploymentState(event.matches);
  });
}

async function initialize() {
  const response = await fetch("site-data.json");
  const data = await response.json();

  renderPublications(data);
  renderContributions(data);
  renderSkills(data.skills);
  renderEducation(data.formal_education);
  renderExperience(data.professional_experience);
  wireTextControls();
  wireAccordions();
  wireEmploymentPanel();
  wirePublicationChart();
  wireScrollSpy();
}

initialize().catch((error) => {
  console.error(error);
});
