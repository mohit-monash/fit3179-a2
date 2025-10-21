document.addEventListener("DOMContentLoaded", async () => {
  const globalYearSelect = document.getElementById("global-year-select");
  const globalYearDisplay = document.getElementById("global-year-display");
  const snapshotCitySelect = document.getElementById("snapshot-city-select");
  const sa3CitySelect = document.getElementById("sa3-city-select");
  const sa3YearSelect = document.getElementById("sa3-year-select");
  const distributionYearSelect = document.getElementById("distribution-year-select");
  const cityYearSelect = document.getElementById("city-year-select");
  const cityYearDisplay = document.getElementById("city-year-display");
  const incomeYearSelect = document.getElementById("income-year-select");
  const stateHighlightSelect = document.getElementById("state-highlight-select");

  const yearLabels = {
    2018: "2017–18",
    2019: "2018–19",
    2020: "2019–20",
    2021: "2020–21",
    2022: "2021–22"
  };

  const embedOptions = { actions: false, renderer: "canvas" };

  const computedStyles = getComputedStyle(document.documentElement);
  const getCssVar = (name, fallback) => {
    const value = computedStyles.getPropertyValue(name);
    return value && value.trim() ? value.trim() : fallback;
  };

  const palette = {
    stateDomain: [
      "New South Wales",
      "Victoria",
      "Queensland",
      "South Australia",
      "Western Australia",
      "Tasmania",
      "Northern Territory",
      "Australian Capital Territory"
    ],
    stateRange: [
      getCssVar("--nsw", "#1f77b4"),
      getCssVar("--vic", "#d62728"),
      getCssVar("--qld", "#ff7f0e"),
      getCssVar("--sa", "#9467bd"),
      getCssVar("--wa", "#2ca02c"),
      getCssVar("--tas", "#8c564b"),
      getCssVar("--nt", "#17becf"),
      getCssVar("--act", "#7f7f7f")
    ],
    capitalDomain: [
      "Sydney",
      "Melbourne",
      "Brisbane",
      "Adelaide",
      "Perth",
      "Hobart",
      "Darwin",
      "Canberra"
    ]
  };

  const capitalRange = [
    getCssVar("--nsw", "#1f77b4"),
    getCssVar("--vic", "#d62728"),
    getCssVar("--qld", "#ff7f0e"),
    getCssVar("--sa", "#9467bd"),
    getCssVar("--wa", "#2ca02c"),
    getCssVar("--tas", "#8c564b"),
    getCssVar("--nt", "#17becf"),
    getCssVar("--act", "#7f7f7f")
  ];

  const arraysEqual = (a, b) =>
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((value, index) => value === b[index]);

  const applyPalette = (spec) => {
    const visit = (node) => {
      if (!node) {
        return;
      }
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      if (typeof node === "object") {
        if (node.scale && node.scale.domain) {
          if (arraysEqual(node.scale.domain, palette.stateDomain)) {
            node.scale.range = [...palette.stateRange];
          } else if (arraysEqual(node.scale.domain, palette.capitalDomain)) {
            node.scale.range = [...capitalRange];
          }
        }
        if (node.scale && Array.isArray(node.scale.range) && node.scale.range.length === 8) {
          node.scale.range = [...palette.stateRange];
        }
        Object.values(node).forEach(visit);
      }
    };

    visit(spec);

    spec.config = spec.config || {};
    spec.config.range = spec.config.range || {};
    if (!spec.config.range.category || spec.config.range.category.length < 8) {
      spec.config.range.category = [...palette.stateRange];
    }

    return spec;
  };

  const stripParamBindings = (spec, names) => {
    if (!Array.isArray(spec.params)) {
      return spec;
    }
    spec.params.forEach((param) => {
      if (!param || typeof param !== "object") {
        return;
      }
      if (!names || names.includes(param.name)) {
        delete param.bind;
      }
    });
    return spec;
  };

  const tweakSubtitle = (spec, updater) => {
    if (spec && spec.title) {
      if (typeof spec.title === "object" && typeof updater === "function") {
        spec.title = { ...spec.title, subtitle: updater(spec.title.subtitle) };
      } else if (typeof spec.title === "string" && typeof updater === "function") {
        spec.title = updater(spec.title);
      }
    }
    return spec;
  };

  const loadSpec = async (path) => {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Unable to load spec: ${path}`);
    }
    return response.json();
  };

  const embedChart = async (selector, path, transform) => {
    const spec = await loadSpec(path);
    const transformed = transform ? transform(spec) : spec;
    return vegaEmbed(selector, transformed, embedOptions);
  };

  const [kpiResult, cityResult, stateTrendResult, salaryShareResult, sa3Result, timeseriesResult, distributionResult] =
    await Promise.all([
      embedChart("#kpi-vis", "specs/kpi_cards.vg.json"),
      embedChart("#city-vis", "specs/city_comparator.vg.json", (spec) => {
        stripParamBindings(spec, ["yearParam"]);
        applyPalette(spec);
        return spec;
      }),
      embedChart("#state-trend-vis", "specs/state_trend.vg.json", (spec) => {
        stripParamBindings(spec, ["focusState"]);
        applyPalette(spec);
        tweakSubtitle(spec, (subtitle) =>
          subtitle ? subtitle.replace("Use the dropdown", "Use the highlight selector") : subtitle
        );
        return spec;
      }),
      embedChart("#salary-share-vis", "specs/salary_share.vg.json", (spec) => {
        stripParamBindings(spec, ["yearParam"]);
        applyPalette(spec);
        return spec;
      }),
      embedChart("#sa3-vis", "specs/sa3_map_rank.vg.json", (spec) => {
        applyPalette(spec);
        return spec;
      }),
      embedChart("#timeseries-vis", "specs/time_series.vg.json", (spec) => {
        applyPalette(spec);
        return spec;
      }),
      embedChart("#distribution-vis", "specs/distribution.vg.json", (spec) => {
        stripParamBindings(spec, ["yearParam"]);
        applyPalette(spec);
        tweakSubtitle(spec, (subtitle) =>
          subtitle ? subtitle.replace("Year selector below", "Year dropdown above") : subtitle
        );
        return spec;
      })
    ]);

  const views = {
    kpi: kpiResult.view,
    city: cityResult.view,
    stateTrend: stateTrendResult.view,
    salaryShare: salaryShareResult.view,
    sa3: sa3Result.view,
    timeseries: timeseriesResult.view,
    distribution: distributionResult.view
  };

  const deriveCityLegendExtrema = () => {
    const view = views.city;
    if (!view || typeof view.getState !== "function") {
      return null;
    }

    try {
      const state = view.getState({ data: true });
      if (!state || !state.data) {
        return null;
      }
      const datasets = Object.values(state.data);
      for (const rows of datasets) {
        if (!Array.isArray(rows) || rows.length === 0) {
          continue;
        }
        const candidate = rows.filter(
          (row) =>
            row &&
            typeof row === "object" &&
            typeof row.city_label === "string" &&
            typeof row.price_to_income === "number"
        );
        if (candidate.length === 0) {
          continue;
        }
        let highest = candidate[0];
        let lowest = candidate[0];
        for (const row of candidate) {
          if (row.price_to_income > highest.price_to_income) {
            highest = row;
          }
          if (row.price_to_income < lowest.price_to_income) {
            lowest = row;
          }
        }
        return {
          highest: highest?.city_label ?? null,
          lowest: lowest?.city_label ?? null
        };
      }
    } catch (error) {
      console.warn("Unable to compute legend extrema:", error);
    }

    return null;
  };

  const applyCityLegendLabels = (extrema) => {
    if (!extrema) {
      return;
    }
    const legendEntries = document.querySelectorAll("#city-vis .vega-legend .vega-legend-entry text");
    if (!legendEntries.length) {
      return;
    }
    legendEntries.forEach((node) => {
      if (!node || typeof node.textContent !== "string") {
        return;
      }
      const base = node.textContent.replace(/\s*\((highest|lowest)\)$/i, "").trim();
      let next = base;
      if (extrema.highest && base === extrema.highest) {
        next = `${base} (highest)`;
      } else if (extrema.lowest && base === extrema.lowest) {
        next = `${base} (lowest)`;
      }
      if (node.textContent !== next) {
        node.textContent = next;
      }
    });
  };

  const updateCityLegendLabels = () => {
    const view = views.city;
    if (!view || typeof view.runAfter !== "function") {
      return;
    }
    const apply = () => {
      const extrema = deriveCityLegendExtrema();
      if (!extrema) {
        return;
      }
      requestAnimationFrame(() => applyCityLegendLabels(extrema));
    };
    apply();
    view.runAfter(apply);
  };

  updateCityLegendLabels();

  const getCityLabel = (value) => {
    if (!value || !snapshotCitySelect) {
      return "";
    }
    const option = Array.from(snapshotCitySelect.options).find((opt) => opt.value === value);
    return option ? option.text.trim() : value.replace("Greater ", "");
  };

  const getKpiYearValue = () => (globalYearSelect ? Number(globalYearSelect.value) : 2022);

  const getYearLabel = (yearValue) => yearLabels[yearValue] || `${yearValue - 1}–${yearValue}`;

  const updateGlobalYearDisplay = (yearValue) => {
    if (globalYearDisplay) {
      globalYearDisplay.textContent = getYearLabel(yearValue);
    }
  };

  const updateCityYearDisplay = (yearValue) => {
    if (cityYearDisplay) {
      cityYearDisplay.textContent = getYearLabel(yearValue);
    }
  };

  const setSignals = async (view, mapping) => {
    if (!view) {
      return;
    }
    let dirty = false;
    for (const [name, value] of Object.entries(mapping)) {
      if (typeof view.signal !== "function") {
        continue;
      }
      try {
        const current = view.signal(name);
        const bothNaN = Number.isNaN(current) && Number.isNaN(value);
        if (current === value || bothNaN) {
          continue;
        }
        view.signal(name, value);
        dirty = true;
      } catch (error) {
        // Ignore missing signals on a view.
      }
    }
    if (dirty) {
      await view.runAsync();
    }
  };

  const updateCityYear = async (yearValue, { syncSelect = false } = {}) => {
    if (syncSelect && cityYearSelect) {
      cityYearSelect.value = String(yearValue);
    }
    updateCityYearDisplay(yearValue);
    await setSignals(views.city, { yearParam: yearValue });
    updateCityLegendLabels();
  };

  const updateKpiSignals = async () => {
    const yearValue = getKpiYearValue();
    const cityValue = snapshotCitySelect ? snapshotCitySelect.value : "Australia";
    await setSignals(views.kpi, {
      yearParam: yearValue,
      yearLabelParam: getYearLabel(yearValue),
      cityParam: cityValue,
      cityLabelParam: getCityLabel(cityValue)
    });
  };

  const refreshKpi = async () => {
    const yearValue = getKpiYearValue();
    updateGlobalYearDisplay(yearValue);
    await updateKpiSignals();
  };

  const updateDistributionYear = async () => {
    if (!distributionYearSelect) {
      return;
    }
    const yearValue = Number(distributionYearSelect.value);
    await setSignals(views.distribution, { yearParam: yearValue });
  };

  const updateSa3Year = async () => {
    if (!sa3YearSelect) {
      return;
    }
    const yearValue = Number(sa3YearSelect.value);
    await setSignals(views.sa3, { yearParam: yearValue });
  };

  const updateSa3City = async () => {
    if (!sa3CitySelect) {
      return;
    }
    await setSignals(views.sa3, { cityParam: sa3CitySelect.value });
  };

  const updateSalaryShareYear = async () => {
    if (!incomeYearSelect) {
      return;
    }
    const yearValue = Number(incomeYearSelect.value);
    await setSignals(views.salaryShare, { yearParam: yearValue });
  };

  const updateStateHighlight = async () => {
    if (!stateHighlightSelect) {
      return;
    }
    await setSignals(views.stateTrend, { focusState: stateHighlightSelect.value });
  };

  if (globalYearSelect) {
    updateGlobalYearDisplay(getKpiYearValue());
    globalYearSelect.addEventListener("change", () => {
      refreshKpi().catch((error) => {
        console.warn("Unable to update scoreboard year:", error);
      });
    });
  }

  if (snapshotCitySelect) {
    snapshotCitySelect.addEventListener("change", () => {
      updateKpiSignals().catch((error) => {
        console.warn("Unable to update scoreboard region:", error);
      });
    });
  }

  if (sa3YearSelect) {
    sa3YearSelect.addEventListener("change", () => {
      updateSa3Year().catch((error) => {
        console.warn("Unable to update SA3 year:", error);
      });
    });
  }

  if (sa3CitySelect) {
    sa3CitySelect.addEventListener("change", () => {
      updateSa3City().catch((error) => {
        console.warn("Unable to update SA3 region:", error);
      });
    });
  }

  if (distributionYearSelect) {
    distributionYearSelect.addEventListener("change", () => {
      updateDistributionYear().catch((error) => {
        console.warn("Unable to update distribution year:", error);
      });
    });
  }

  if (incomeYearSelect) {
    incomeYearSelect.addEventListener("change", () => {
      updateSalaryShareYear().catch((error) => {
        console.warn("Unable to update salary share year:", error);
      });
    });
  }

  if (cityYearSelect) {
    updateCityYearDisplay(Number(cityYearSelect.value || getKpiYearValue()));
    cityYearSelect.addEventListener("change", () => {
      const yearValue = Number(cityYearSelect.value);
      updateCityYear(yearValue).catch((error) => {
        console.warn("Unable to update capital city year:", error);
      });
    });
  }

  if (stateHighlightSelect) {
    stateHighlightSelect.value = "All";
    stateHighlightSelect.addEventListener("change", () => {
      updateStateHighlight().catch((error) => {
        console.warn("Unable to update state highlight:", error);
      });
    });
  }

  // Initial renders
  await refreshKpi();
  await updateCityYear(Number(cityYearSelect?.value || 2022), { syncSelect: false });
  await updateSalaryShareYear();
  await updateSa3Year();
  await updateSa3City();
  await updateDistributionYear();
  await updateStateHighlight();
});
